export interface VideoCastConfig {
  enabled: boolean;
  selectedDisplay: string;
  castEnabled: boolean;
  showOverlay: boolean;
}

export const defaultVideoCastConfig: VideoCastConfig = {
  enabled: false,
  selectedDisplay: '',
  castEnabled: false,
  showOverlay: true,
};
