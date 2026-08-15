const STORAGE_KEY = "parcelos-bt-printer";

const OPTIONAL_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
] as const;

type GattChar = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue: (data: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
};

type GattService = {
  getCharacteristics: () => Promise<GattChar[]>;
};

type GattServer = {
  connected: boolean;
  connect: () => Promise<GattServer>;
  getPrimaryServices: () => Promise<GattService[]>;
};

type BtDevice = {
  id: string;
  gatt?: GattServer;
};

function bluetooth():
  | {
      getDevices?: () => Promise<BtDevice[]>;
      requestDevice: (opts: Record<string, unknown>) => Promise<BtDevice>;
    }
  | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { bluetooth?: ReturnType<typeof bluetooth> }).bluetooth;
}

function encodeEscPos(lines: string[]): Uint8Array {
  const chunks: number[] = [0x1b, 0x40, 0x1b, 0x61, 0x01];
  const pushText = (s: string) => {
    for (const ch of s) chunks.push(ch.charCodeAt(0) & 0xff);
    chunks.push(0x0a);
  };
  for (const line of lines) pushText(line);
  chunks.push(0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x10);
  return new Uint8Array(chunks);
}

async function findWritableChar(server: GattServer): Promise<GattChar | null> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (writable) return writable;
  }
  return null;
}

async function writeChunks(char: GattChar, bytes: Uint8Array) {
  const size = 100;
  for (let i = 0; i < bytes.length; i += size) {
    const slice = bytes.slice(i, i + size);
    if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) {
      await char.writeValueWithoutResponse(slice);
    } else {
      await char.writeValue(slice);
    }
  }
}

async function rememberPrinter(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

async function pickDevice(forceChooser: boolean): Promise<BtDevice | null> {
  const bt = bluetooth();
  if (!bt) return null;

  const saved = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();

  if (bt.getDevices) {
    try {
      const known = await bt.getDevices();
      const match = (saved ? known.find((d) => d.id === saved) : undefined) ?? known[0];
      if (match) return match;
    } catch {
      /* continue */
    }
  }

  if (!forceChooser) return null;

  try {
    const device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: [...OPTIONAL_SERVICES],
    });
    rememberPrinter(device.id);
    return device;
  } catch {
    return null;
  }
}

/** Sends ESC/POS to a previously allowed or newly chosen Bluetooth printer. */
export async function printViaBluetooth(lines: string[]): Promise<boolean> {
  const device = await pickDevice(false);
  if (!device?.gatt) return false;

  try {
    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    const char = await findWritableChar(server);
    if (!char) return false;
    await writeChunks(char, encodeEscPos(lines));
    return true;
  } catch (err) {
    console.warn("[printViaBluetooth]", err);
    return false;
  }
}

export function canUseBluetoothPrint(): boolean {
  return Boolean(bluetooth());
}
