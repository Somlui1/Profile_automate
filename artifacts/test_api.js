const http = require('http');

http.get('http://localhost:8000/api/v1/jobs/490a43f3-9963-4636-be6d-d2fc35450c9d/logs', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json.logs.slice(0, 5), null, 2));
    } catch(e) {
        console.error("Error parsing JSON:", e);
        console.log("Raw output:", data);
    }
  });
}).on('error', (err) => {
  console.log('Error 8000: ', err.message);
  
  // Try 8002
  http.get('http://localhost:8002/api/v1/jobs/490a43f3-9963-4636-be6d-d2fc35450c9d/logs', (res2) => {
    let data2 = '';
    res2.on('data', (chunk) => data2 += chunk);
    res2.on('end', () => {
        try {
            const json2 = JSON.parse(data2);
            console.log(JSON.stringify(json2.logs.slice(0, 5), null, 2));
        } catch(e) {
            console.error("Error parsing JSON:", e);
            console.log("Raw output:", data2);
        }
    });
  }).on('error', (err2) => console.log('Error 8002: ', err2.message));
});
