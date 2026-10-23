// Builds the body expected by `GET /iclock/cdata?SN=...&options=all`, the
// ZKTeco device's init handshake. Must be CRLF-terminated with
// "GET OPTION FROM: <SN>" as the first line, or the device ignores it and
// falls back to firmware defaults.
export function buildHandshakeResponse(sn: string): string {
  const lines = [
    `GET OPTION FROM: ${sn}`,
    'ATTLOGStamp=9999',
    'OPERLOGStamp=9999',
    'ATTPHOTOStamp=None',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=TransData AttLog OpLog AttPhoto EnrollUser ChgUser EnrollFP ChgFP UserPic',
    'Realtime=1',
    'Encrypt=None',
    'ServerVer=2.4.2',
  ];
  return lines.join('\r\n') + '\r\n';
}
