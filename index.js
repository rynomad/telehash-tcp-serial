
var lob = require('lob-enc');
var fs = require('fs');
var crc = require('crc');
var serialPort = require('serialport');
var net = require('net')

exports.name = 'tcp-serial';

function error(err)
{
  console.error(err);
  process.exit(1);
}

// add our transport to this new mesh
exports.mesh = function(mesh, cbExt)
{
  var args = mesh.args||{};
  var telehash = mesh.lib;

  var tp = {pipes:{}};

  tp.server = net.createServer((sock) => {
    console.log("got sock")
    tp.pipe(false, {
      type: 'tcp-serial',
      ip: sock.remoteAddress,
      port: sock.remotePort
    }, function(pipe) {
      console.log("use sock")
      pipe.use(sock);
    });
  })

  console.log("tcp-serial listen", args.tcpSerial || 4443)
  tp.server.listen(args.tcpSerial || 4443)

  // return our current addressible paths
  tp.paths = function(){
    return [];
  };

  tp.pipe = function(link, path, cbPipe) {
    if (typeof path != 'object' || path.type != 'tcp-serial') return false;
    if (typeof path.ip != 'string' || typeof path.port != 'number') return false;
    var id = [path.ip, path.port].join(':');
    var pipe = tp.pipes[id];
    if (pipe) return cbPipe(pipe);
    //console.log("new pipe with keepalive", exports.keepalive)
    pipe = new telehash.Pipe('tcp-serial', 60000);
    tp.pipes[id] = pipe;
    pipe.id = id;
    pipe.path = path;

    // util to add/use this socket
    pipe.use = function(sock) {
      //console.log("use sock")
      pipe.chunks = lob.chunking({size:32, blocking:true}, function receive(err, packet){
        console.log("got usb packet", packet.head, packet.json, packet)
        if(err || !packet)
        {
          mesh.log.error('pipe chunk read error',err,pipe.id);
          return;
        }
        // handle incoming greeting as a discovery
        if(packet.head.length > 1)
        {
          console.log("DISCO")
          var greeting = packet.json;
          greeting.pipe = pipe;
          mesh.discovered(greeting);
        }else{
          console.log("RECV")
          mesh.receive(packet, pipe);
        }
      });

      if (pipe.sock) pipe.sock.end();
      // track this sock and 'pipe' it to/from our chunks
      pipe.sock = sock;
      sock.pipe(pipe.chunks);
      pipe.chunks.pipe(sock);
      sock.on('error', function(error) {}); // ignore errors, just handle end
      sock.on('end', function() {
        //console.log("SOCKET END")
        pipe.emit('down', pipe)
        delete pipe.sock;
      })

      pipe.chunks.send(lob.encode(mesh.json()));
    }
    
    pipe.onSend = function(packet, link, cb) {
      pipe.chunks.send(packet);
      cb()
    }
    
    cbPipe(pipe);
  };

  cbExt(null, tp)

}