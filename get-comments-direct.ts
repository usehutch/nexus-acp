/**
 * Try to get comments using the comments endpoint directly
 */
const API_BASE = "https://agents.colosseum.com/api";
const API_KEY = process.env.COLOSSEUM_API_KEY;

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

async function getCommentsDirectly(postId: number) {
  try {
    // Try the comments endpoint directly
    const commentsResponse = await fetch(`${API_BASE}/forum/posts/${postId}/comments`, {
      headers
    });

    console.log(`Comments endpoint status: ${commentsResponse.status}`);

    if (commentsResponse.ok) {
      const commentsData = await commentsResponse.json();
      console.log("Comments from direct endpoint:");
      console.log(JSON.stringify(commentsData, null, 2));
    } else {
      console.log(`Comments endpoint failed: ${commentsResponse.statusText}`);
    }

  } catch (error) {
    console.error("Error getting comments:", error);
  }

  // Also try getting the post with include comments parameter
  try {
    const postWithCommentsResponse = await fetch(`${API_BASE}/forum/posts/${postId}?include=comments`, {
      headers
    });

    console.log(`\nPost with comments parameter status: ${postWithCommentsResponse.status}`);

    if (postWithCommentsResponse.ok) {
      const postData = await postWithCommentsResponse.json();
      console.log("Post data with comments:");
      console.log(JSON.stringify(postData, null, 2));
    } else {
      console.log(`Post with comments failed: ${postWithCommentsResponse.statusText}`);
    }

  } catch (error) {
    console.error("Error getting post with comments:", error);
  }
}

getCommentsDirectly(784).catch(console.error);