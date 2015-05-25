var test = require('tape');
var Stream = require('stream')
var EventEmitter = require('events').EventEmitter
var ComlinkClient = require('./client');
var ComlinkServer = require('./server');

var mkStream = function(){
  var stream = new Stream();
  stream.writable = stream.readable = true;
  stream.destroy = function(){
  };
  return stream;
};

var setup = function(o, connEvents, history){
  var onStream = ComlinkServer(undefined, undefined, o, true);
  var client = ComlinkClient(undefined, function(){

    var stream_client_end = mkStream();
    var stream_server_end = mkStream();
    stream_client_end.write = function(data){
      stream_server_end.emit('data', data);
    };
    stream_server_end.write = function(data){
      stream_client_end.emit('data', data);
    };

    process.nextTick(function(){
      onStream(stream_server_end);
      stream_client_end.emit('connect');
    });
    connEvents.on('client_end_error', function(){
      stream_client_end.emit('error', new Error('some client connection error'));
    });

    return stream_client_end;
  });

  client.on('connect', function(){
    history.push(['client on connect']);
  });
  client.on('remote', function(){
    history.push(['client on remote']);
  });
  client.on('disconnect', function(){
    history.push(['client on disconnect']);
  });
  client.on('reconnect', function(n, delay){
    history.push(['client on reconnect', n, delay]);
  });
  client.on('error', function(err){
    history.push(['client error', err.toString()]);
  });
  client.on('call', function(method){
    history.push(['client call', method]);
  });

  return client;
};

test("connect then call functions", function(t){
  var history = [];
  var done = function(){
    t.deepEquals(history, [
      ['client on connect'],
      ['client on remote'],
      ['client call', 'hello'],
      ['server hello', 'martin'],
      ['client call', 'hello'],
      ['server hello', 'tim'],
      ['client hello', null, 'Hello, martin'],
      ['client hello', null, 'Hello, tim']
    ]);
    t.end();
  };

  var connEvents = new EventEmitter()
  var client = setup({
    hello: function(name, callback){
      history.push(['server hello', name]);

      process.nextTick(function(){
        callback(undefined, 'Hello, ' + name);
      });
    }
  }, connEvents, history);

  client.on('remote', function(){
    client.call('hello', 'martin', function(err, resp){
      history.push(['client hello', err, resp]);
    });
    client.call('hello', 'tim', function(err, resp){
      history.push(['client hello', err, resp]);
      done();
    });
  });
});

test("call then connect", function(t){
  var history = [];
  var done = function(){
    t.deepEquals(history, [
      ['client call', 'hello'],
      ['client call', 'hello'],
      ['client on connect'],
      ['client on remote'],
      ['server hello', 'martin'],
      ['server hello', 'tim'],
      ['client hello', null, 'Hello, martin'],
      ['client hello', null, 'Hello, tim']
    ]);
    t.end();
  };

  var connEvents = new EventEmitter()
  var client = setup({
    hello: function(name, callback){
      history.push(['server hello', name]);

      process.nextTick(function(){
        callback(undefined, 'Hello, ' + name);
      });
    }
  }, connEvents, history);

  client.call('hello', 'martin', function(err, resp){
    history.push(['client hello', err, resp]);
  });
  client.call('hello', 'tim', function(err, resp){
    history.push(['client hello', err, resp]);
    done();
  });
});
