import { $fetch } from 'ofetch';
import fs from 'fs';

async function test() {
  const blob = new Blob(['{"test": true}'], { type: 'application/json' });
  const formData = new FormData();
  formData.append('file', blob, 'canvas.json');

  try {
    const res = await $fetch('http://localhost:3001/api/storage/upload?key=test.json&contentType=application/json', {
      method: 'POST',
      body: formData,
      // Need a valid token to bypass 401... Let me bypass auth in the API temporarily.
    });
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}
test();
