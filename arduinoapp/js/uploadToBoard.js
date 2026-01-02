// AI generated. I don't know how it works, but it works.
/**
 * Arduino Web Serial Uploader
 * Based on https://github.com/kaelhem/avrbro
 * Supports STK500v1 protocol (Arduino Uno, Nano)
 */

// ============== CONSTANTS ==============
const STK = {
  GET_SYNC: 0x30,
  SET_DEVICE: 0x42,
  ENTER_PROGMODE: 0x50,
  LEAVE_PROGMODE: 0x51,
  LOAD_ADDRESS: 0x55,
  PROG_PAGE: 0x64,
  READ_PAGE: 0x74,
  READ_SIGN: 0x75,
  CRC_EOP: 0x20,
  INSYNC: 0x14,
  OK: 0x10,
  NOSYNC: 0x15
};

const OK_RESPONSE = new Uint8Array([STK.INSYNC, STK.OK]);

// ============== BOARD CONFIG ==============
const BOARDS = {
  uno: {
    name: 'uno',
    baud: 115200,
    signature: new Uint8Array([0x1e, 0x95, 0x0f]),
    pageSize: 128,
    timeout: 400
  },
  nano: {
    name: 'nano',
    baud: 57600,
    signature: new Uint8Array([0x1e, 0x95, 0x0f]),
    pageSize: 128,
    timeout: 400
  },
  mega: {
    name: 'mega',
    baud: 115200,
    signature: new Uint8Array([0x1e, 0x98, 0x01]), // ATmega2560 signature
    pageSize: 256,
    timeout: 400
  },
};

// ============== HEX PARSER ==============
function parseIntelHex(data) {
  const EMPTY_VALUE = 0xFF;
  let buf = new Uint8Array(8192);
  let bufLength = 0;
  let highAddress = 0;
  let lineNum = 0;
  let pos = 0;

  while (pos < data.length) {
    // Skip whitespace
    while (pos < data.length && (data[pos] === '\r' || data[pos] === '\n' || data[pos] === ' ')) {
      pos++;
    }
    if (pos >= data.length) break;

    // Each line starts with ':'
    if (data[pos] !== ':') {
      throw new Error(`Line ${lineNum + 1} does not start with ':'`);
    }
    pos++;
    lineNum++;

    // Parse line
    const dataLength = parseInt(data.substr(pos, 2), 16); pos += 2;
    const lowAddress = parseInt(data.substr(pos, 4), 16); pos += 4;
    const recordType = parseInt(data.substr(pos, 2), 16); pos += 2;
    
    const dataField = data.substr(pos, dataLength * 2);
    const dataBytes = new Uint8Array(dataLength);
    for (let i = 0; i < dataLength; i++) {
      dataBytes[i] = parseInt(dataField.substr(i * 2, 2), 16);
    }
    pos += dataLength * 2;
    pos += 2; // Skip checksum

    switch (recordType) {
      case 0: // DATA
        const absoluteAddress = highAddress + lowAddress;
        // Expand buffer if needed
        if (absoluteAddress + dataLength >= buf.length) {
          const newBuf = new Uint8Array((absoluteAddress + dataLength) * 2);
          newBuf.set(buf);
          buf = newBuf;
        }
        // Fill gaps with 0xFF
        if (absoluteAddress > bufLength) {
          buf.fill(EMPTY_VALUE, bufLength, absoluteAddress);
        }
        // Copy data
        buf.set(dataBytes, absoluteAddress);
        bufLength = Math.max(bufLength, absoluteAddress + dataLength);
        break;
      case 1: // EOF
        return buf.slice(0, bufLength);
      case 2: // Extended Segment Address
        highAddress = parseInt(dataField, 16) << 4;
        break;
      case 4: // Extended Linear Address
        highAddress = parseInt(dataField, 16) << 16;
        break;
    }
  }
  
  return buf.slice(0, bufLength);
}

// ============== SERIAL HELPERS ==============
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============== STK500 PROTOCOL ==============
async function receiveData(reader, timeout, responseLength) {
  let buffer = new Uint8Array(0);
  let started = false;
  let timeoutId = null;
  let finished = false;
  let error = null;

  const finish = (err) => {
    if (timeoutId) clearTimeout(timeoutId);
    finished = true;
    error = err;
  };

  const handleChunk = (data) => {
    let startIndex = 0;
    
    // Look for INSYNC byte to start
    if (!started) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] === STK.INSYNC) {
          started = true;
          startIndex = i;
          break;
        }
      }
      if (!started) return; // Haven't found INSYNC yet
    }

    // Append data to buffer
    const newData = data.slice(startIndex);
    const newBuffer = new Uint8Array(buffer.length + newData.length);
    newBuffer.set(buffer);
    newBuffer.set(newData, buffer.length);
    buffer = newBuffer;

    if (buffer.length > responseLength) {
      finish(new Error(`Buffer overflow ${buffer.length} > ${responseLength}`));
    } else if (buffer.length === responseLength) {
      finish(null);
    }
  };

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      finish(new Error(`Timeout after ${timeout}ms`));
    }, timeout);
  }

  while (!finished) {
    try {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        handleChunk(value);
      }
    } catch (err) {
      finish(err);
      break;
    }
  }

  if (error) throw error;
  return buffer;
}

async function sendCommand(serial, options) {
  const { reader, writer } = serial;
  const timeout = options.timeout || 0;
  let responseLength = 0;

  if (options.responseData) {
    responseLength = options.responseData.length;
  }
  if (options.responseLength) {
    responseLength = options.responseLength;
  }

  // Build command with CRC_EOP
  let cmd = options.cmd;
  if (Array.isArray(cmd)) {
    cmd = new Uint8Array([...cmd, STK.CRC_EOP]);
  } else if (cmd instanceof Uint8Array) {
    // Check if it already has CRC_EOP
    if (cmd[cmd.length - 1] !== STK.CRC_EOP) {
      const newCmd = new Uint8Array(cmd.length + 1);
      newCmd.set(cmd);
      newCmd[cmd.length] = STK.CRC_EOP;
      cmd = newCmd;
    }
  }

  await writer.write(cmd);
  
  const data = await receiveData(reader, timeout, responseLength);
  
  if (options.responseData && !arraysEqual(data, options.responseData)) {
    const got = Array.from(data).map(b => b.toString(16)).join(' ');
    const expected = Array.from(options.responseData).map(b => b.toString(16)).join(' ');
    throw new Error(`Response mismatch: got [${got}], expected [${expected}]`);
  }
  
  return data;
}

async function sync(serial, attempts, options) {
  const opt = {
    cmd: [STK.GET_SYNC],
    responseData: OK_RESPONSE,
    timeout: options.timeout
  };

  for (let tries = 0; tries < attempts; tries++) {
    try {
      const result = await sendCommand(serial, opt);
      console.log(`Sync successful on attempt ${tries + 1}`);
      return result;
    } catch (err) {
      console.log(`Sync attempt ${tries + 1} failed:`, err.message);
    }
  }
  throw new Error(`Sync failed after ${attempts} attempts`);
}

async function verifySignature(serial, signature, options) {
  const opt = {
    cmd: [STK.READ_SIGN],
    responseLength: 5,
    timeout: options.timeout
  };

  const data = await sendCommand(serial, opt);
  console.log('Signature:', Array.from(data.slice(1, 4)).map(b => '0x' + b.toString(16)).join(' '));
  return data;
}

async function setOptions(serial, pageSize, options) {
  const pagesizehigh = (pageSize >> 8) & 0xff;
  const pagesizelow = pageSize & 0xff;
  
  const opt = {
    cmd: [
      STK.SET_DEVICE,
      0x86, // devicecode
      0x00, // revision
      0x00, // progtype
      0x01, // parmode
      0x01, // polling
      0x01, // selftimed
      0x01, // lockbytes
      0x03, // fusebytes
      0xff, // flashpollval1
      0xff, // flashpollval2
      0xff, // eeprompollval1
      0xff, // eeprompollval2
      pagesizehigh,
      pagesizelow,
      0x00, // eepromsizehigh
      0x04, // eepromsizelow
      0x00, // flashsize4
      0x00, // flashsize3
      0x80, // flashsize2
      0x00  // flashsize1
    ],
    responseData: OK_RESPONSE,
    timeout: options.timeout
  };

  return sendCommand(serial, opt);
}

async function enterProgrammingMode(serial, options) {
  const opt = {
    cmd: [STK.ENTER_PROGMODE],
    responseData: OK_RESPONSE,
    timeout: options.timeout
  };
  return sendCommand(serial, opt);
}

async function loadAddress(serial, address, options) {
  const opt = {
    cmd: [STK.LOAD_ADDRESS, address & 0xff, (address >> 8) & 0xff],
    responseData: OK_RESPONSE,
    timeout: options.timeout
  };
  return sendCommand(serial, opt);
}

async function loadPage(serial, writeBytes, options) {
  const bytesLow = writeBytes.length & 0xff;
  const bytesHigh = (writeBytes.length >> 8) & 0xff;
  
  const cmd = new Uint8Array(4 + writeBytes.length + 1);
  cmd[0] = STK.PROG_PAGE;
  cmd[1] = bytesHigh;
  cmd[2] = bytesLow;
  cmd[3] = 0x46; // Flash memory type
  cmd.set(writeBytes, 4);
  cmd[cmd.length - 1] = STK.CRC_EOP;

  const opt = {
    cmd: cmd,
    responseData: OK_RESPONSE,
    timeout: options.timeout
  };
  return sendCommand(serial, opt);
}

async function upload(serial, hex, options) {
  const { pageSize } = options;
  let pageaddr = 0;

  while (pageaddr < hex.length) {
    const useaddr = pageaddr >> 1;
    await loadAddress(serial, useaddr, options);
    
    const endAddr = Math.min(hex.length, pageaddr + pageSize);
    const writeBytes = hex.slice(pageaddr, endAddr);
    await loadPage(serial, writeBytes, options);
    
    pageaddr += writeBytes.length;
    await wait(4);
    
    // Progress
    const progress = Math.round((pageaddr / hex.length) * 100);
    if (progress % 20 === 0) {
      console.log(`Upload progress: ${progress}%`);
    }
  }
  
  console.log('Upload complete');
  return true;
}

async function exitProgrammingMode(serial, options) {
  const opt = {
    cmd: [STK.LEAVE_PROGMODE],
    responseData: OK_RESPONSE,
    timeout: options.timeout
  };
  return sendCommand(serial, opt);
}

async function bootload(serial, hex, options) {
  // Triple sync like avrdude
  console.log('Syncing with bootloader...');
  await sync(serial, 3, options);
  await sync(serial, 3, options);
  await sync(serial, 3, options);

  console.log('Reading signature...');
  await verifySignature(serial, options.signature, options);

  console.log('Setting device options...');
  await setOptions(serial, options.pageSize, options);

  console.log('Entering programming mode...');
  await enterProgrammingMode(serial, options);

  console.log('Uploading firmware...');
  await upload(serial, hex, options);

  console.log('Exiting programming mode...');
  await exitProgrammingMode(serial, options);

  return true;
}

// ============== PUBLIC API ==============
async function openSerial(options = {}) {
  const { baudRate = 115200 } = options;

  if (!navigator.serial) {
    throw new Error('Web Serial API not available. Use Chrome or Edge.');
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate });
    
    const reader = port.readable.getReader();
    const writer = port.writable.getWriter();
    
    return { port, reader, writer };
  } catch (e) {
    console.error('Failed to open serial:', e);
    return null;
  }
}

async function closeSerial(serial) {
  try {
    serial.writer.releaseLock();
    serial.reader.releaseLock();
    await serial.port.close();
  } catch (e) {
    console.error('Error closing serial:', e);
  }
}

async function reset(serial) {
  console.log('Resetting board...');
  await serial.port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await wait(250);
  await serial.port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await wait(50);
}

async function flash(serial, hexData, options = {}) {
  const { boardName = 'uno', debug = true } = options;
  
  const board = BOARDS[boardName];
  if (!board) {
    throw new Error(`Unknown board: ${boardName}`);
  }

  const flashOptions = {
    ...board,
    debug
  };

  try {
    await reset(serial);
    const result = await bootload(serial, hexData, flashOptions);
    console.log('Flash completed successfully!');
    return result;
  } catch (err) {
    console.error('Flash failed:', err);
    throw err;
  }
}

// ============== MAIN UPLOAD FUNCTION ==============
async function uploadToArduino(hexString, boardName = 'uno') {
  const hex = (typeof hexString === 'string' && hexString.trim()) ? hexString : null;

  if (!hex) {
    console.error('No HEX data provided.');
    throw new Error('HEX data is required');
  }

  const board = BOARDS[boardName];
  if (!board) {
    console.error(`Unknown board: ${boardName}`);
    throw new Error(`Unknown board: ${boardName}`);
  }

  // Open serial connection
  const serial = await openSerial({ baudRate: board.baud });
  if (!serial) {
    console.error('Failed to open serial port. Operation cancelled.');
    return;
  }

  try {
    // Parse hex file
    console.log('Parsing hex file...');
    const hexBuffer = parseIntelHex(hex);
    console.log(`Parsed ${hexBuffer.length} bytes`);

    // Flash the board
    const success = await flash(serial, hexBuffer, { boardName });
    
    if (success) {
      console.log('Upload completed successfully!');
    }
  } catch (err) {
    console.error(`Upload failed: ${err.message}`);
    throw err;
  } finally {
    await closeSerial(serial);
  }
}

// Expose to window
window.uploadToArduino = uploadToArduino;
window.openSerial = openSerial;
window.closeSerial = closeSerial;
window.flash = flash;
window.reset = reset;
window.parseIntelHex = parseIntelHex;
