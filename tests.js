var test = require('tape');
var Stream = require('stream')
var EventEmitter = require('events').EventEmitter
var ComlinkClient = require('./client');
var ComlinkServer = require('./server');

var mkStream = function(){
  var stream = new Stream();
  stream.writable = stream.readable = true;
  return stream;
};

var setup = function(o, connEvents, history){
  var server = ComlinkServer(undefined, undefined, o, true);
  var client = ComlinkClient(undefined, function(){

    var stream_client_side = mkStream();
    var stream_server_side = mkStream();
    var is_dead = false;
    stream_client_side.destroy = stream_server_side.destroy = function(){
      is_dead = true;
    };
    stream_client_side.write = function(data){
      if(is_dead) return;
      stream_server_side.emit('data', data);
    };
    stream_server_side.write = function(data){
      if(is_dead) return;
      stream_client_side.emit('data', data);
    };

    process.nextTick(function(){
      server.onStream(stream_server_side);
      stream_client_side.emit('connect');
    });
    connEvents.on('connection_error', function(){
      is_dead = true;
      stream_client_side.emit('error', new Error('some connection error (client side)'));
      stream_server_side.emit('error', new Error('some connection error (server side)'));
    });

    return stream_client_side;
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

  server.on('fail', function(err){
    history.push(['server fail', err.toString()]);
  });
  server.on('error', function(err){
    history.push(['server error', err.toString()]);
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

test("connect, call, error, call, then after reconnect observe the call went through", function(t){
  var history = [];
  var done = function(){
    t.deepEquals(history, [
      ['client on connect'],
      ['client on remote'],
      ['client call', 'hello'],
      ['server hello', 'martin'],
      ['client hello', null, 'Hello, martin'],
      ['client error', 'Error: some connection error (client side)'],
      ['client on disconnect'],
      ['client call', 'hello'],
      ['client error', 'Error: some connection error (client side)'],
      ['server error', 'Error: some connection error (server side)'],
      ['client on reconnect', 0, 100],
      ['client on connect'],
      ['client on remote'],
      ['server hello', 'tim'],
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

  client.once('remote', function(){
    client.call('hello', 'martin', function(err, resp){
      history.push(['client hello', err, resp]);
      connEvents.emit('connection_error');
    });
  });
  client.on('disconnect', function(){
    client.call('hello', 'tim', function(err, resp){
      history.push(['client hello', err, resp]);
      done();
    });
  });
});
