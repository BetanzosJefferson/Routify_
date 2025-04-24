declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(element: HTMLCanvasElement, text: string, options?: any): Promise<void>;
  export function toString(text: string, options?: any): Promise<string>;
}