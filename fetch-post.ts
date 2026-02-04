const postId = process.argv[2] || '719';
const response = await fetch(`https://agents.colosseum.com/api/forum/posts/${postId}`, {
  headers: { 'Authorization': 'Bearer ' + process.env.COLOSSEUM_API_KEY }
});

if (!response.ok) {
  console.error(`Error: ${response.status} - ${response.statusText}`);
  process.exit(1);
}

const data = await response.json();
console.log(JSON.stringify(data, null, 2));