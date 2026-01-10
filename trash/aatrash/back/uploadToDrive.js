import fs from 'fs';
import { google } from 'googleapis';

export async function uploadToDrive(filePath, fileName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credenciales.json', // tu archivo de credenciales
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

  const fileMetadata = { 
    name: fileName,
    parents: ['1oVBWLLdtum9xfofFPOB_yiiphRigp9AG']
  };
  const media = { mimeType: 'video/mp4', body: fs.createReadStream(filePath) };

  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });

  console.log('Archivo subido a Drive, ID:', res.data.id);
  return res.data.id;
}