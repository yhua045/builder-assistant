// Mock for react-native-fs
const RNFS = {
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/caches',
  ExternalDirectoryPath: '/mock/external',
  DownloadDirectoryPath: '/mock/downloads',
  TemporaryDirectoryPath: '/mock/temp',
  LibraryDirectoryPath: '/mock/library',
  
  // File operations
  copyFile: jest.fn(async (from, to) => {
    console.log(`Mock RNFS: copyFile from ${from} to ${to}`);
    return Promise.resolve();
  }),
  
  exists: jest.fn(async (path) => {
    console.log(`Mock RNFS: exists ${path}`);
    return Promise.resolve(true);
  }),
  
  mkdir: jest.fn(async (path) => {
    console.log(`Mock RNFS: mkdir ${path}`);
    return Promise.resolve();
  }),
  
  readFile: jest.fn(async (path) => {
    console.log(`Mock RNFS: readFile ${path}`);
    return Promise.resolve('mock file content');
  }),
  
  writeFile: jest.fn(async (path, content) => {
    console.log(`Mock RNFS: writeFile ${path}`);
    return Promise.resolve();
  }),
  
  unlink: jest.fn(async (path) => {
    console.log(`Mock RNFS: unlink ${path}`);
    return Promise.resolve();
  }),
  
  readDir: jest.fn(async (path) => {
    console.log(`Mock RNFS: readDir ${path}`);
    return Promise.resolve([]);
  }),
};

export default RNFS;
