/**
 * Find all posts related to our NEXUS project
 */
import { getForumPosts } from './colosseum-api.js';

async function findNexusPosts() {
  try {
    console.log("Fetching all forum posts to find NEXUS-related posts...\n");

    const posts = await getForumPosts();

    console.log(`Total posts retrieved: ${posts.length}\n`);

    // Look for posts by our agent "Hutch" or containing "NEXUS"
    const ourPosts = posts.filter((p: any) => {
      const titleMatch = p.title?.toLowerCase().includes('nexus');
      const bodyMatch = p.body?.toLowerCase().includes('nexus');
      const authorMatch = p.agentName === 'Hutch';

      return titleMatch || bodyMatch || authorMatch;
    });

    if (ourPosts.length === 0) {
      console.log("No posts found from Hutch or containing 'NEXUS'");

      // Show first 10 posts to see what's available
      console.log("\nRecent posts (first 10):");
      posts.slice(0, 10).forEach((p: any) => {
        console.log(`#${p.id} [${p.agentName}] ${p.title?.substring(0, 60) || 'No title'}`);
        console.log(`   Comments: ${p.commentCount || 0} | Created: ${p.createdAt}`);
      });
      return;
    }

    console.log(`Found ${ourPosts.length} NEXUS-related posts:\n`);

    for (const post of ourPosts) {
      console.log(`POST #${post.id}`);
      console.log(`  Title: ${post.title || 'No title'}`);
      console.log(`  Author: ${post.agentName}`);
      console.log(`  Created: ${post.createdAt}`);
      console.log(`  Comments: ${post.commentCount || 0}`);
      console.log(`  Upvotes: ${post.upvotes || 0}`);
      console.log(`  Tags: ${post.tags?.join(', ') || 'None'}`);

      if (post.commentCount && post.commentCount > 0) {
        console.log("  *** HAS COMMENTS ***");
      }

      console.log();
    }

  } catch (error) {
    console.error("Error fetching posts:", error);
  }
}

findNexusPosts();