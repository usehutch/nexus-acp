/**
 * Colosseum API Client - USE THIS FOR ALL FORUM/PROJECT OPERATIONS
 * Writing local .md files does NOT post to the forum!
 */

import {
  ErrorCode,
  NexusError,
  errorHandler,
  withRetry,
  validateRequired
} from './error-handler.js';

const API_BASE = "https://agents.colosseum.com/api";
const API_KEY = process.env.COLOSSEUM_API_KEY;

if (!API_KEY) {
  console.error("ERROR: COLOSSEUM_API_KEY not set in environment");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

// API rate limits from documentation
const RATE_LIMITS = {
  FORUM_OPERATIONS: { maxRequests: 30, windowMs: 60 * 60 * 1000 }, // 30/hour
  FORUM_VOTES: { maxRequests: 120, windowMs: 60 * 60 * 1000 }, // 120/hour
  PROJECT_OPERATIONS: { maxRequests: 30, windowMs: 60 * 60 * 1000 } // 30/hour
};

// Simple rate limiting tracker
const rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(operation: keyof typeof RATE_LIMITS): void {
  const limit = RATE_LIMITS[operation];
  const now = Date.now();
  const key = operation;

  let tracker = rateLimitTracker.get(key);
  if (!tracker || now > tracker.resetTime) {
    tracker = { count: 0, resetTime: now + limit.windowMs };
    rateLimitTracker.set(key, tracker);
  }

  if (tracker.count >= limit.maxRequests) {
    const resetIn = Math.ceil((tracker.resetTime - now) / 1000);
    throw new NexusError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded for ${operation}. Reset in ${resetIn} seconds.`,
      { operation, resetIn, maxRequests: limit.maxRequests },
      true
    );
  }

  tracker.count++;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  operation: keyof typeof RATE_LIMITS
): Promise<T> {
  return withRetry(async () => {
    checkRateLimit(operation);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorCode = ErrorCode.NETWORK_ERROR;

      try {
        const errorData = await response.json() as ApiErrorResponse;
        errorMessage = errorData.message || errorData.error || errorMessage;

        if (response.status === 401) errorCode = ErrorCode.UNAUTHORIZED;
        else if (response.status === 429) errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
        else if (response.status >= 500) errorCode = ErrorCode.INTERNAL_SERVER_ERROR;

        throw new NexusError(
          errorCode,
          `Colosseum API error: ${errorMessage}`,
          { status: response.status, endpoint, errorData },
          response.status >= 500 || response.status === 429
        );
      } catch (parseError) {
        throw new NexusError(
          errorCode,
          `Colosseum API error: ${errorMessage}`,
          { status: response.status, endpoint },
          response.status >= 500 || response.status === 429
        );
      }
    }

    try {
      return await response.json() as T;
    } catch (parseError) {
      throw new NexusError(
        ErrorCode.INVALID_FORMAT,
        'Failed to parse Colosseum API response as JSON',
        { endpoint, parseError: parseError instanceof Error ? parseError.message : parseError },
        false
      );
    }
  }, `Colosseum API ${endpoint}`, { maxRetries: 3 });
}

export async function postToForum(title: string, body: string, tags: string[] = ["progress-update"]) {
  try {
    validateRequired({ title, body }, ['title', 'body'], 'postToForum');

    if (!Array.isArray(tags) || tags.length === 0) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Tags must be a non-empty array',
        { tags }
      );
    }

    console.log(`Posting to forum: "${title}"`);

    const data = await apiRequest<{ post: any }>('/forum/posts', {
      method: "POST",
      body: JSON.stringify({ title, body, tags })
    }, 'FORUM_OPERATIONS');

    console.log(`SUCCESS: Posted #${data.post.id}`);
    return data.post;
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'postToForum');
    errorHandler.logError(nexusError, 'postToForum');
    throw nexusError;
  }
}

export async function commentOnPost(postId: number, body: string) {
  try {
    validateRequired({ postId, body }, ['postId', 'body'], 'commentOnPost');

    if (!Number.isInteger(postId) || postId <= 0) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Post ID must be a positive integer',
        { postId }
      );
    }

    console.log(`Commenting on post #${postId}`);

    const data = await apiRequest<{ comment: any }>(`/forum/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    }, 'FORUM_OPERATIONS');

    console.log(`SUCCESS: Comment posted`);
    return data.comment;
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'commentOnPost');
    errorHandler.logError(nexusError, 'commentOnPost');
    throw nexusError;
  }
}

export async function voteOnPost(postId: number, vote: 1 | -1 = 1) {
  try {
    validateRequired({ postId, vote }, ['postId', 'vote'], 'voteOnPost');

    if (!Number.isInteger(postId) || postId <= 0) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Post ID must be a positive integer',
        { postId }
      );
    }

    if (vote !== 1 && vote !== -1) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Vote must be 1 (upvote) or -1 (downvote)',
        { vote }
      );
    }

    console.log(`Voting ${vote > 0 ? "up" : "down"} on post #${postId}`);

    const data = await apiRequest<any>(`/forum/posts/${postId}/vote`, {
      method: "POST",
      body: JSON.stringify({ value: vote })
    }, 'FORUM_VOTES');

    console.log(`SUCCESS: Voted`);
    return data;
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'voteOnPost');
    errorHandler.logError(nexusError, 'voteOnPost');
    throw nexusError;
  }
}

export async function updateProject(updates: Record<string, any>) {
  try {
    if (!updates || Object.keys(updates).length === 0) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Updates object cannot be empty',
        { updates }
      );
    }

    console.log("Updating project...");

    const data = await apiRequest<{ project: any }>('/my-project', {
      method: "PUT",
      body: JSON.stringify(updates)
    }, 'PROJECT_OPERATIONS');

    console.log("SUCCESS: Project updated");
    return data.project;
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'updateProject');
    errorHandler.logError(nexusError, 'updateProject');
    throw nexusError;
  }
}

export async function getForumPosts() {
  try {
    const data = await apiRequest<{ posts: any[] }>('/forum/posts', {
      method: 'GET'
    }, 'FORUM_OPERATIONS');

    return data.posts || [];
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'getForumPosts');
    errorHandler.logError(nexusError, 'getForumPosts');
    throw nexusError;
  }
}

export async function getMyProject() {
  try {
    return await apiRequest<any>('/my-project', {
      method: 'GET'
    }, 'PROJECT_OPERATIONS');
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'getMyProject');
    errorHandler.logError(nexusError, 'getMyProject');
    throw nexusError;
  }
}

export async function getPostById(postId: number) {
  try {
    validateRequired({ postId }, ['postId'], 'getPostById');

    if (!Number.isInteger(postId) || postId <= 0) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Post ID must be a positive integer',
        { postId }
      );
    }

    return await apiRequest<any>(`/forum/posts/${postId}`, {
      method: 'GET'
    }, 'FORUM_OPERATIONS');
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'getPostById');
    errorHandler.logError(nexusError, 'getPostById');
    throw nexusError;
  }
}

export async function getPostComments(postId: number) {
  try {
    validateRequired({ postId }, ['postId'], 'getPostComments');

    if (!Number.isInteger(postId) || postId <= 0) {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        'Post ID must be a positive integer',
        { postId }
      );
    }

    return await apiRequest<any>(`/forum/posts/${postId}/comments`, {
      method: 'GET'
    }, 'FORUM_OPERATIONS');
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'getPostComments');
    errorHandler.logError(nexusError, 'getPostComments');
    throw nexusError;
  }
}

// CLI usage with enhanced error handling
const command = process.argv[2];
const args = process.argv.slice(3);

async function runCLI() {
  try {
    if (command === "post") {
      const title = args[0];
      const body = args[1];
      const tags = args[2]?.split(",") || ["progress-update"];

      if (!title || !body) {
        throw new NexusError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Title and body are required for posting',
          { providedArgs: args }
        );
      }

      await postToForum(title, body, tags);
    } else if (command === "comment") {
      const postIdArg = args[0];
      const body = args[1];

      if (!postIdArg || !body) {
        throw new NexusError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Post ID and comment body are required',
          { providedArgs: args }
        );
      }

      const postId = parseInt(postIdArg);
      if (!Number.isInteger(postId) || postId <= 0) {
        throw new NexusError(
          ErrorCode.INVALID_INPUT,
          'Post ID must be a valid positive integer',
          { providedArgs: args }
        );
      }

      await commentOnPost(postId, body);
    } else if (command === "vote") {
      const postIdArg = args[0];
      const vote = parseInt(args[1] || "1") as 1 | -1;

      if (!postIdArg) {
        throw new NexusError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Post ID is required for voting',
          { providedArgs: args }
        );
      }

      const postId = parseInt(postIdArg);
      if (!Number.isInteger(postId) || postId <= 0) {
        throw new NexusError(
          ErrorCode.INVALID_INPUT,
          'Post ID must be a valid positive integer',
          { providedArgs: args }
        );
      }

      await voteOnPost(postId, vote);
    } else if (command === "list") {
      const posts = await getForumPosts();
      posts.slice(0, 10).forEach((p: any) =>
        console.log(`#${p.id} [${p.agentName}] ${p.title.substring(0, 50)}`)
      );
    } else if (command === "status") {
      const project = await getMyProject();
      console.log(JSON.stringify(project, null, 2));
    } else if (command === "get") {
      const postIdArg = args[0];

      if (!postIdArg) {
        throw new NexusError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Post ID is required',
          { providedArgs: args }
        );
      }

      const postId = parseInt(postIdArg);
      if (!Number.isInteger(postId) || postId <= 0) {
        throw new NexusError(
          ErrorCode.INVALID_INPUT,
          'Post ID must be a valid positive integer',
          { providedArgs: args }
        );
      }

      const post = await getPostById(postId);
      console.log(JSON.stringify(post, null, 2));
    } else if (command === "comments") {
      const postIdArg = args[0];

      if (!postIdArg) {
        throw new NexusError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Post ID is required',
          { providedArgs: args }
        );
      }

      const postId = parseInt(postIdArg);
      if (!Number.isInteger(postId) || postId <= 0) {
        throw new NexusError(
          ErrorCode.INVALID_INPUT,
          'Post ID must be a valid positive integer',
          { providedArgs: args }
        );
      }

      const comments = await getPostComments(postId);
      console.log(JSON.stringify(comments, null, 2));
    } else if (command === "help" || !command) {
      console.log("NEXUS Colosseum API CLI");
      console.log("Usage: bun colosseum-api.ts <command> [args]\\n");
      console.log("Commands:");
      console.log("  post <title> <body> [tags]   - Create a forum post");
      console.log("  comment <postId> <body>      - Comment on a post");
      console.log("  vote <postId> [vote]         - Vote on a post (1 or -1)");
      console.log("  list                         - List recent forum posts");
      console.log("  get <postId>                 - Get a specific post by ID");
      console.log("  comments <postId>            - Get comments for a post");
      console.log("  status                       - Show project status");
      console.log("  help                         - Show this help message");
    } else {
      throw new NexusError(
        ErrorCode.INVALID_INPUT,
        `Unknown command: ${command}`,
        { command, availableCommands: ['post', 'comment', 'vote', 'list', 'get', 'comments', 'status', 'help'] }
      );
    }
  } catch (error) {
    const nexusError = errorHandler.normalizeError(error, 'CLI');
    errorHandler.logError(nexusError, 'CLI');
    process.exit(1);
  }
}

// Only run CLI if this file is executed directly
if (import.meta.main) {
  runCLI();
}
