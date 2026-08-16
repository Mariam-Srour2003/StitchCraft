export interface Project {
  id: string;
  userId: string;
  name: string;
  patternIds: string[];
  sourceImageRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
