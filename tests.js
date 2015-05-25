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

var logStream = function(stream, name){
  stream.on('connect', function(){
    console.log(name, 'connect');
  });
  stream.on('data', function(data){
    console.log(name, 'data', data);
  });
};

var setup = function(o, connEvents){
  var onStream = ComlinkServer(undefined, undefined, o, true);
  var client = ComlinkClient(undefined, function(){

    var client_stream = mkStream();
    var server_stream = mkStream();
    client_stream.write = function(data){
      server_stream.emit('data', data);
    };
    server_stream.write = function(data){
      client_stream.emit('data', data);
    };
    //logStream(client_stream, 'client_stream');
    //logStream(server_stream, 'server_stream');

    connEvents.on('connect', function(){
      onStream(server_stream);
      client_stream.emit('connect');
    });
    connEvents.on('client_end_error', function(){
      client_stream.emit('error', new Error('some client connection error'));
    });

    return client_stream;
  });

  return client;
};

test("connect then call functions", function(t){
  t.plan(6);

  var connEvents = new EventEmitter()

  var client = setup({
    hello: (function(){
      var call_n = 0;
      return function(name, callback){
        t.equals(name, call_n === 0 ? 'martin' : 'tim');
        call_n++;
        process.nextTick(function(){
          callback(undefined, 'Hello, '+ name);
        });
      };
    }())
  }, connEvents);

  connEvents.emit('connect');

  client.on('remote', function(){
    client.call('hello', 'martin', function(err, resp){
      t.notOk(err);
      t.equals(resp, 'Hello, martin');
    });
    client.call('hello', 'tim', function(err, resp){
      t.notOk(err);
      t.equals(resp, 'Hello, tim');
    });
  });
});

test("call then connect", function(t){
  t.plan(6);

  var connEvents = new EventEmitter()

  var client = setup({
    hello: (function(){
      var call_n = 0;
      return function(name, callback){
        t.equals(name, call_n === 0 ? 'martin' : 'tim');
        call_n++;
        process.nextTick(function(){
          callback(undefined, 'Hello, '+ name);
        });
      };
    }())
  }, connEvents);

  client.call('hello', 'martin', function(err, resp){
    t.notOk(err);
    t.equals(resp, 'Hello, martin');
  });
  client.call('hello', 'tim', function(err, resp){
    t.notOk(err);
    t.equals(resp, 'Hello, tim');
  });

  process.nextTick(function(){
    connEvents.emit('connect');
  });
});
