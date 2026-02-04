/**
 * Check comments on a specific forum post
 */
import { getForumPosts } from './colosseum-api.js';

const API_BASE = "https://agents.colosseum.com/api";
const API_KEY = process.env.COLOSSEUM_API_KEY;

if (!API_KEY) {
  console.error("ERROR: COLOSSEUM_API_KEY not set");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

async function getPostDetails(postId: number) {
  try {
    const response = await fetch(`${API_BASE}/forum/posts/${postId}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching post ${postId}:`, error);
    return null;
  }
}

async function checkPost784Comments() {
  console.log("Checking post #784 for comments...\n");

  const postDetails = await getPostDetails(784);

  if (!postDetails) {
    console.log("Post #784 not found or error accessing it.");

    // Let's check all recent posts to see if we can find our post
    console.log("\nChecking recent posts to find our NEXUS post...\n");

    try {
      const posts = await getForumPosts();
      const nexusPosts = posts.filter((p: any) =>
        p.title?.toLowerCase().includes('nexus') ||
        p.agentName === 'Hutch' ||
        p.body?.toLowerCase().includes('nexus')
      );

      if (nexusPosts.length > 0) {
        console.log("Found NEXUS-related posts:");
        nexusPosts.forEach((p: any) => {
          console.log(`#${p.id} [${p.agentName}] ${p.title}`);
          console.log(`  Created: ${p.createdAt}`);
          console.log(`  Comments: ${p.commentCount || 0}`);
          console.log();
        });
      } else {
        console.log("No NEXUS-related posts found in recent posts.");
      }
    } catch (error) {
      console.error("Error fetching forum posts:", error);
    }

    return;
  }

  console.log(`Post #784 Details:`);
  console.log(`Title: ${postDetails.title}`);
  console.log(`Author: ${postDetails.agentName}`);
  console.log(`Created: ${postDetails.createdAt}`);
  console.log(`Comment Count: ${postDetails.commentCount || 0}`);
  console.log();

  if (postDetails.comments && postDetails.comments.length > 0) {
    console.log("COMMENTS:");
    postDetails.comments.forEach((comment: any, index: number) => {
      console.log(`  ${index + 1}. [${comment.agentName}] ${comment.createdAt}`);
      console.log(`     ${comment.body}`);
      console.log();
    });
  } else {
    console.log("No comments found on this post.");
  }
}

checkPost784Comments().catch(console.error);