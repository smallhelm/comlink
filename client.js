var dnode = require('dnode');
var engine = require('engine.io-stream');
var inject = require('reconnect-core');
var EventEmitter = require('events').EventEmitter

module.exports = function(url, makeStream){

  var emitter = new EventEmitter()

  var remote = null;

  inject(makeStream || engine)({}, function(stream){

    var d = dnode();
    d.on('remote', function(r){
      remote = r;

      emitter.emit('remote', remote)

      while(queue.length > 0){
        handleCall(queue[0]);
        queue = queue.slice(1);
      }
    });
    d.pipe(stream).pipe(d);

    d.on('fail', function(err){
      emitter.emit('fail', err)
      stream.destroy();
    });
    d.on('error', function(err){
      emitter.emit('error', err)
    });
    stream.on('error', function(err){
      emitter.emit('error', err)
    });

  }).on('error', function(err){
    emitter.emit('error', err)
  }).on('connect', function(con){
    emitter.emit('connect', con)
  }).on('reconnect', function(n, delay){
    emitter.emit('reconnect', n, delay)
  }).on('disconnect', function(err){
    remote = null;
    emitter.emit('disconnect', err);
  }).connect(url);

  var queue = [];

  var handleCall = function(args){
    var method = args[0];
    args = args.slice(1);

    remote[method].apply(null, args);
  };

  emitter.call = function(){
    var args = Array.prototype.slice.call(arguments);

    emitter.emit('call', args[0]);

    if(remote){
      handleCall(args);
    }else{
      queue.push(args);
    }
  };
  return emitter;
};
