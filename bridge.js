const serialport = require("serialport");
const net = require('net');
var shouldscan = true;

const scan = module.exports = (args) => {
  if (shouldscan){
    serialport.list((err, ports) => {
      if (err)
        return err;
      
      ports.forEach((port) => {
        if (port.vendorId == args.vendorId && port.productId == args.productId){
          var sPort = new serialport.SerialPort(port.comName, {  baudrate: 115200}, false);
          shouldscan = false;
          sPort.open((err) => {
            if (err)
              return shouldscan = true;
    
            console.log("serial open")
            var sock = net.connect(args.target)

            sPort.end = () => {}
            sock.end = () => {}

            sPort.pipe(sock)
            sock.pipe(sPort)

          })
  
          sPort.on('error', () => shouldscan = true)
          sPort.on('close', () => shouldscan = true)
        }
      })
    })
  } 

  setTimeout(() => scan(args), 5000)
} 