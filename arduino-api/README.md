# Arduino Compile API

A simple API for compiling Arduino sketches and returning the compiled hex file.

## Setup

### 1. Install 32-bit libraries (Linux)

```bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install -y libc6:i386
```

### 2. Install arduino-cli

```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
```

This installs `arduino-cli` to `./bin/`.

### 3. Install the Arduino AVR core

```bash
./bin/arduino-cli core update-index
./bin/arduino-cli core install arduino:avr
```

### 4. Install dependencies and run

```bash
pnpm install
pnpm start
```

Server runs on port 8001 by default.

## API

### POST /api/compile

Compiles Arduino code and returns the hex file.

**Request:**
```json
{
  "arduino_code": "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }"
}
```

**Response:**
```json
{
  "hex_data": ":100000000C9434000C9446000C9446000C94460084..."
}
```

### GET /api/health

Returns `{ "status": "ok" }` if the server is running.

