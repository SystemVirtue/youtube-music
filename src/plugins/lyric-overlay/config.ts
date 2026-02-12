export type OverlayPosition = 'top' | 'center' | 'bottom';
export type OverlayStyle = 'default' | 'karaoke' | 'minimal';

export interface LyricOverlayConfig {
  enabled: boolean;
  position: OverlayPosition;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  style: OverlayStyle;
  showOnVideoOnly: boolean;
}

export const defaultLyricOverlayConfig: LyricOverlayConfig = {
  enabled: false,
  position: 'bottom',
  fontSize: 24,
  fontColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  style: 'default',
  showOnVideoOnly: true,
};
