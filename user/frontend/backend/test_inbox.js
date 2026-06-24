const http = require('http');

http.get('http://127.0.0.1:5000/api/agents/inbox', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log(JSON.stringify(parsed, null, 2));
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
