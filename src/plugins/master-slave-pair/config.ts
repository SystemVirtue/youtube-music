export enum InstanceRole {
  NONE = 'NONE',
  MASTER = 'MASTER',
  SLAVE = 'SLAVE',
}

export interface MasterSlavePairConfig {
  enabled: boolean;
  role: InstanceRole;
  masterHost: string;
  masterPort: number;
  slaveHost: string;
  slavePort: number;
  autoConnect: boolean;
}

export const defaultMasterSlavePairConfig: MasterSlavePairConfig = {
  enabled: false,
  role: InstanceRole.NONE,
  masterHost: '127.0.0.1',
  masterPort: 26539,
  slaveHost: '127.0.0.1',
  slavePort: 26540,
  autoConnect: false,
};
