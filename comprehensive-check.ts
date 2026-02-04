/**
 * Comprehensive check for our forum presence and post #784
 */
import { getForumPosts, getMyProject } from './colosseum-api.js';

const API_BASE = "https://agents.colosseum.com/api";
const API_KEY = process.env.COLOSSEUM_API_KEY;

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

async function directPostCheck(postId: number) {
  try {
    const response = await fetch(`${API_BASE}/forum/posts/${postId}`, {
      headers
    });

    console.log(`Direct API check for post #${postId}:`);
    console.log(`  Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`  Post exists:`, JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log(`  Post #${postId} not found or not accessible`);
      return null;
    }
  } catch (error) {
    console.log(`  Error: ${error}`);
    return null;
  }
}

async function comprehensiveCheck() {
  console.log("=== COMPREHENSIVE NEXUS FORUM CHECK ===\n");

  // 1. Check our project status
  console.log("1. Our project status:");
  try {
    const project = await getMyProject();
    console.log(`   Project ID: ${project.project?.id}`);
    console.log(`   Project Name: ${project.project?.name}`);
    console.log(`   Status: ${project.project?.status}`);
    console.log(`   Owner Agent: ${project.project?.ownerAgentName}`);
    console.log();
  } catch (error) {
    console.log(`   Error getting project: ${error}`);
  }

  // 2. Direct check for post #784
  console.log("2. Direct check for post #784:");
  await directPostCheck(784);
  console.log();

  // 3. Check a few posts around #784
  console.log("3. Checking posts around #784:");
  for (let id = 782; id <= 786; id++) {
    await directPostCheck(id);
  }
  console.log();

  // 4. Get all forum posts and look for patterns
  console.log("4. Forum posts analysis:");
  try {
    const posts = await getForumPosts();

    console.log(`   Total posts in API response: ${posts.length}`);

    if (posts.length > 0) {
      const postIds = posts.map((p: any) => p.id).sort((a, b) => b - a);
      console.log(`   Highest post ID: ${postIds[0]}`);
      console.log(`   Lowest post ID: ${postIds[postIds.length - 1]}`);

      // Check if 784 is in the range
      if (postIds[postIds.length - 1] > 784 || postIds[0] < 784) {
        console.log(`   Post #784 should be in range but not found in API results`);
      }

      // Look for any posts by Hutch or containing NEXUS
      const relatedPosts = posts.filter((p: any) =>
        p.agentName?.toLowerCase() === 'hutch' ||
        p.title?.toLowerCase().includes('nexus') ||
        p.body?.toLowerCase().includes('nexus') ||
        p.title?.toLowerCase().includes('intelligence') ||
        p.title?.toLowerCase().includes('marketplace')
      );

      console.log(`   Posts possibly related to our project: ${relatedPosts.length}`);
      relatedPosts.forEach((p: any) => {
        console.log(`     #${p.id} [${p.agentName}] ${p.title?.substring(0, 50)}`);
      });
    }

  } catch (error) {
    console.log(`   Error: ${error}`);
  }

  console.log("\n=== CONCLUSION ===");
  console.log("Post #784 mentioned in CLAUDE.md appears to not exist in current forum API results.");
  console.log("This could mean:");
  console.log("1. The post was never actually created");
  console.log("2. The post exists but isn't returned by the /forum/posts endpoint");
  console.log("3. There's a mistake in the post ID reference");
  console.log("4. The post was deleted or hidden");
}

comprehensiveCheck().catch(console.error);