var dnode = require('dnode');
var EngineServer = require('engine.io-stream');
var EventEmitter = require('events').EventEmitter


module.exports = function(server, url, cons, __for_testing_return_clientJustConnected){

  var emitter = new EventEmitter()

  var onStream = function(stream){
    var d = dnode(cons);
    d.pipe(stream).pipe(d);

    d.on('fail', function(err){
      emitter.emit('fail', err);
      stream.destroy();
    });
    d.on('error', function(err){
      emitter.emit('error', err);
    });
    stream.on('error', function(err){
      emitter.emit('error', err);
    });
  };

  if(__for_testing_return_clientJustConnected){
    emitter.onStream = onStream;
    return emitter;
  }
  var engine = EngineServer(onStream);
  engine.attach(server, url);

  return emitter;
};
