var dnode = require('dnode');
var EngineServer = require('engine.io-stream');


module.exports = function(server, url, cons, __for_testing_return_clientJustConnected){

  var onStream = function(stream){
    console.log('SERVER onStream');
    var d = dnode(cons);
    d.pipe(stream).pipe(d);

    d.on('fail', function(){
      console.error('dnode fail', arguments);
      stream.destroy();
    });
    d.on("error", function(){
      console.error('dnode error', arguments);
    });
    stream.on("error", function(){
      console.error('stream error', arguments);
    });
  };

  if(__for_testing_return_clientJustConnected){
    return onStream;
  }
  var engine = EngineServer(onStream);
  engine.attach(server, url);
};
