import fs from 'fs';
import { google } from 'googleapis';

/**
 * Sube un archivo a Google Drive
 * @param {string} filePath - Ruta local del archivo a subir
 * @param {string} fileName - Nombre que tendrá el archivo en Drive
 * @returns {Promise<string>} ID del archivo en Google Drive
 */
export async function uploadToDrive(filePath, fileName) {
  try {
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    // Configurar autenticación
    // Nota: Debes crear un archivo credentials.json con las credenciales de tu proyecto
    // desde Google Cloud Console
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const client = await auth.getClient();
    google.options({ auth: client });

    const drive = google.drive({ version: 'v3' });

    console.log(`☁️ Subiendo ${fileName} a Google Drive...`);

    // Subir archivo
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        // Para subir a una carpeta específica, descomenta y configura:
        // parents: [process.env.GOOGLE_FOLDER_ID]
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    console.log(`✅ Archivo subido correctamente. ID: ${res.data.id}`);

    // Opcional: Eliminar archivo local después de subirlo
    fs.unlinkSync(filePath);
    console.log(`🗑️ Archivo local eliminado: ${filePath}`);

    return res.data.id;
  } catch (error) {
    console.error('❌ Error subiendo a Google Drive:', error.message);
    throw error;
  }
}

/**
 * Obtiene la URL pública de un archivo en Google Drive
 * @param {string} fileId - ID del archivo en Drive
 * @returns {Promise<string>} URL pública del archivo
 */
export async function getPublicUrl(fileId) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const client = await auth.getClient();
    google.options({ auth: client });

    const drive = google.drive({ version: 'v3' });

    // Hacer el archivo público
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Obtener información del archivo
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink',
    });

    return file.data.webViewLink;
  } catch (error) {
    console.error('❌ Error obteniendo URL pública:', error.message);
    throw error;
  }
}
