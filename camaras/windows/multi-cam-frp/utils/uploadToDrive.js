import fs from 'fs';
import { google } from 'googleapis';

const drive = google.drive({ version: 'v3' });

export async function uploadToDrive(filePath, fileName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const client = await auth.getClient();
  google.options({ auth: client });

  const res = await drive.files.create({
    requestBody: { name: fileName },
    media: { body: fs.createReadStream(filePath) },
  });
  return res.data.id;
}