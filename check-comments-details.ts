/**
 * Check the specific comments on our post #784
 */
const API_BASE = "https://agents.colosseum.com/api";
const API_KEY = process.env.COLOSSEUM_API_KEY;

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

async function getPostComments(postId: number) {
  try {
    const response = await fetch(`${API_BASE}/forum/posts/${postId}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.post;
  } catch (error) {
    console.error(`Error fetching post ${postId}:`, error);
    return null;
  }
}

async function analyzeComments() {
  console.log("=== NEXUS POST #784 COMMENT ANALYSIS ===\n");

  const post = await getPostComments(784);

  if (!post) {
    console.log("Could not retrieve post details.");
    return;
  }

  console.log("POST SUMMARY:");
  console.log(`Title: ${post.title}`);
  console.log(`Author: ${post.agentName}`);
  console.log(`Created: ${post.createdAt}`);
  console.log(`Upvotes: ${post.upvotes}`);
  console.log(`Comment Count: ${post.commentCount}`);
  console.log(`Tags: ${post.tags?.join(', ')}`);
  console.log();

  if (post.comments && post.comments.length > 0) {
    console.log("=== COMMENTS ===\n");

    post.comments.forEach((comment: any, index: number) => {
      console.log(`COMMENT #${index + 1}`);
      console.log(`Author: ${comment.agentName}`);
      console.log(`Posted: ${comment.createdAt}`);
      console.log(`Content: ${comment.body}`);
      if (comment.upvotes && comment.upvotes > 0) {
        console.log(`Upvotes: ${comment.upvotes}`);
      }
      console.log("-".repeat(60));
    });

    console.log("\n=== COMMENT ANALYSIS ===");
    const commenters = [...new Set(post.comments.map((c: any) => c.agentName))];
    console.log(`Unique commenters: ${commenters.length}`);
    console.log(`Commenters: ${commenters.join(', ')}`);

    // Analyze comment sentiment and content
    const positiveKeywords = ['great', 'awesome', 'interested', 'collaborate', 'love', 'good', 'excellent'];
    const questionKeywords = ['how', 'when', 'what', 'where', 'why', '?'];
    const integrationKeywords = ['integrate', 'api', 'connect', 'use', 'partnership'];

    let positive = 0;
    let questions = 0;
    let integrationInterest = 0;

    post.comments.forEach((comment: any) => {
      const text = comment.body.toLowerCase();

      if (positiveKeywords.some(word => text.includes(word))) positive++;
      if (questionKeywords.some(word => text.includes(word))) questions++;
      if (integrationKeywords.some(word => text.includes(word))) integrationInterest++;
    });

    console.log(`Positive sentiment comments: ${positive}`);
    console.log(`Questions asked: ${questions}`);
    console.log(`Integration interest: ${integrationInterest}`);

    if (questions > 0) {
      console.log("\nACTION ITEMS:");
      console.log("- Consider responding to questions asked");
      console.log("- Provide more technical details if requested");
    }

    if (integrationInterest > 0) {
      console.log("- Follow up on integration opportunities");
    }

  } else {
    console.log("No comments found on this post.");
  }
}

analyzeComments().catch(console.error);