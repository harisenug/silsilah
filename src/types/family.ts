export type Gender = 'M' | 'F';

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: string;
  deathYear?: string;
  photoId?: string; // File ID foto profil di Google Drive
  notes?: string;
  parentFamilyId: string | null;
  ownFamilyIds: string[];
}

export interface NuclearFamily {
  id: string;
  husbandId: string | null;
  wifeId: string | null;
  marriageYear?: string;
  residence?: string;
  backgroundPhotoId?: string; // File ID foto background halaman keluarga di Drive
  notes?: string;
  childrenIds: string[];
}

export interface FamilyBookData {
  bookTitle: string;
  rootFamilyId: string;
  updatedAt: string;
  people: Record<string, Person>;
  families: Record<string, NuclearFamily>;
}
