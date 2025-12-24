declare module 'react-qr-code' {
  import * as React from 'react';

  export interface QRCodeProps extends Omit<React.SVGProps<SVGSVGElement>, 'bgColor' | 'fgColor'> {
    value: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    bgColor?: string;
    fgColor?: string;
  }

  const QRCode: React.FC<QRCodeProps>;
  export default QRCode;
}
