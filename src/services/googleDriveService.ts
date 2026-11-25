import { FamilyBookData } from '../types/family';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'silsilah-keluarga.json';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export const requestGoogleDriveToken = (
  clientId: string,
  forceAccountSelect = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services belum termuat.'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Gagal mendapatkan token Google Drive.'));
          return;
        }
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken({
      prompt: forceAccountSelect ? 'select_account consent' : 'consent',
    });
  });
};

export interface DriveBookFile {
  fileId: string;
  name: string;
  data: FamilyBookData;
}

export const findOrCreateBookInDrive = async (
  accessToken: string,
  fallbackData: FamilyBookData
): Promise<DriveBookFile> => {
  const query = encodeURIComponent(
    `name='${FILE_NAME}' and mimeType='application/json' and trashed=false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchRes.ok) {
    throw new Error('Gagal mencari file di Google Drive.');
  }

  const searchJson = await searchRes.json();
  const existingFile = searchJson.files?.[0];

  if (existingFile) {
    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!contentRes.ok) {
      throw new Error('Gagal membaca isi file silsilah dari Google Drive.');
    }
    const rawText = await contentRes.text();
    let parsed: FamilyBookData;
    try {
      parsed = JSON.parse(rawText) as FamilyBookData;
      if (!parsed.people || !parsed.families) {
        throw new Error('Struktur JSON tidak valid.');
      }
    } catch {
      throw new Error(
        'File silsilah-keluarga.json di Drive rusak/tidak valid. Gunakan fitur Import JSON cadangan.'
      );
    }

    return { fileId: existingFile.id, name: existingFile.name, data: parsed };
  }

  const metadata = {
    name: FILE_NAME,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(fallbackData, null, 2)], { type: 'application/json' }));

  const createRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!createRes.ok) {
    throw new Error('Gagal membuat file silsilah baru di Google Drive.');
  }

  const created = await createRes.json();
  return { fileId: created.id, name: created.name, data: fallbackData };
};

export const saveBookToDrive = async (
  accessToken: string,
  fileId: string,
  data: FamilyBookData
): Promise<void> => {
  const payload: FamilyBookData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload, null, 2),
    }
  );

  if (!res.ok) {
    throw new Error('Gagal menyimpan perubahan ke Google Drive.');
  }
};

export const uploadPhotoToDrive = async (
  accessToken: string,
  file: File,
  prefix = 'silsilah'
): Promise<string> => {
  const safeName = `${prefix}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const metadata = {
    name: safeName,
    mimeType: file.type || 'image/jpeg',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) {
    throw new Error('Gagal mengunggah foto ke Google Drive.');
  }

  const json = await res.json();
  return json.id as string;
};

export const fetchDriveImageAsObjectUrl = async (
  accessToken: string,
  fileId: string
): Promise<string> => {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error('Gagal memuat gambar dari Google Drive.');
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
};
