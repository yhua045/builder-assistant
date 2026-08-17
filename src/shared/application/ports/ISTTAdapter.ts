/** Converts raw audio bytes to a plain transcript string. */
export interface ISTTAdapter {
  transcribe(audio: ArrayBuffer, mimeType: string): Promise<string>;
}

export default ISTTAdapter;
