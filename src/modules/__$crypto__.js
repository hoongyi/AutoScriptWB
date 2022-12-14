let binder = require('./binder')

module.exports = (runtime, scope) => {
  binder(scope, '$crypto', () => {

    var javax = Packages.javax;
    var MessageDigest = java.security.MessageDigest;
    var Base64 = android.util.Base64;
    var Cipher = javax.crypto.Cipher;
    var SecretKeySpec = javax.crypto.spec.SecretKeySpec;
    var KeyPairGenerator = java.security.KeyPairGenerator;
    var X509EncodedKeySpec = java.security.spec.X509EncodedKeySpec;
    var PKCS8EncodedKeySpec = java.security.spec.PKCS8EncodedKeySpec;
    var KeyFactory = java.security.KeyFactory;
    var CipherOutputStream = javax.crypto.CipherOutputStream;
    var ByteArrayOutputStream = java.io.ByteArrayOutputStream;

    var hex_util = new HexUtil()

    function $cypto () {

    }

    $cypto.digest = function (message, algorithm, options) {
      options = options || {};
      let instance = MessageDigest.getInstance(algorithm);
      $cypto._input(message, options, (bytes, start, length) => {
        instance.update(bytes, start, length);
      });
      let bytes = instance.digest();
      return $cypto._output(bytes, options, 'hex');
    }

    $cypto._input = function (input, options, callback) {
      if (options.input == 'file') {
        let fis = new java.io.FileInputStream(input);
        let buffer = util.java.array('byte', 4096);
        while (true) {
          let r = fis.read(buffer);
          if (r > 0) {
            callback(buffer, 0, r);
          } else {
            break;
          }
        }
        return;
      }
      if (options.input == 'base64') {
        input = Base64.decode(input, Base64.NO_WRAP);
      } else if (options.input == 'hex') {
        input = $cypto._fromHex(input);
      } else {
        let encoding = options.encoding || "utf-8";
        if (typeof (input) == 'string') {
          input = new java.lang.String(input).getBytes(encoding);
        }
      }
      callback(input, 0, input.length);
    }

    $cypto._output = function (bytes, options, defFormat) {
      let format = options.output || defFormat;
      if (format == 'base64') {
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
      }
      if (format == 'bytes') {
        return bytes;
      }
      let encoding = options.encoding || "utf-8";
      if (format == 'string') {
        return String(new java.lang.String(bytes, encoding));
      }
      return $cypto._toHex(bytes);
    }

    $cypto._toHex = function (bytes) {
      return hex_util.toHex(bytes);
    }

    $cypto._fromHex = function (bytes) {
      return hex_util.fromHex(bytes);
    }

    $cypto.Key = Key;

    $cypto.encrypt = function (data, key, algorithm, options) {
      return $cypto._chiper(data, Cipher.ENCRYPT_MODE, key, algorithm, options);
    }

    $cypto.decrypt = function (data, key, algorithm, options) {
      return $cypto._chiper(data, Cipher.DECRYPT_MODE, key, algorithm, options);
    }

    $cypto._chiper = function (data, mode, key, algorithm, options) {
      options = options || {};
      let cipher = Cipher.getInstance(algorithm);
      cipher.init(mode, key.toKeySpec(algorithm));
      let os;
      let isFile = options.output == 'file' && options.dest;
      if (isFile) {
        os = new java.io.FileOutputStream(options.dest);
      } else {
        os = new ByteArrayOutputStream();
      }
      let cos = new CipherOutputStream(os, cipher);
      $cypto._input(data, options, (bytes, start, length) => {
        cos.write(bytes, start, length);
      });
      cos.close();
      os.close();
      if (!isFile) {
        let result = os.toByteArray();
        return $crypto._output(result, options, 'bytes');
      }
    }

    $cypto.generateKeyPair = function (algorithm, length) {
      let generator = KeyPairGenerator.getInstance(algorithm);
      length = length || 256;
      generator.initialize(length);
      let keyPair = generator.generateKeyPair();
      return new KeyPair(keyPair.getPublic().getEncoded(), keyPair.getPrivate().getEncoded());
    }

    function Key (data, options) {
      options = options || {};
      this.keyPair = options.keyPair;
      let bos = new java.io.ByteArrayOutputStream();
      $cypto._input(data, options, (bytes, start, length) => {
        bos.write(bytes, start, length);
      });
      this.data = bos.toByteArray();
    }

    Key.prototype.toKeySpec = function (algorithm) {
      let i = algorithm.indexOf("/");
      if (i >= 0) {
        algorithm = algorithm.substring(0, i);
      }
      if (algorithm == 'RSA') {
        if (this.keyPair == 'public') {
          return KeyFactory.getInstance(algorithm).generatePublic(new X509EncodedKeySpec(this.data));
        }
        if (this.keyPair == 'private') {
          return KeyFactory.getInstance(algorithm).generatePrivate(new PKCS8EncodedKeySpec(this.data));
        }
        throw new Error()
      }
      return new SecretKeySpec(this.data, algorithm);
    }

    Key.prototype.toString = function () {
      let data = Base64.encodeToString(this.data, Base64.NO_WRAP);
      if (this.keyPair) {
        return "Key[" + this.keyPair + "]{data='" + data + "'}";
      }
      return "Key{data='" + data + "'}";
    }

    function HexUtil () {
      const BYTE_ARRAY = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']
      this.toHex = function (bytes) {
        if (bytes && bytes.length > 0) {
          let stringBuilder = new java.lang.StringBuilder()
          bytes.forEach(byte => {
            stringBuilder.append(BYTE_ARRAY[(byte & 0xF0) >> 4]).append(BYTE_ARRAY[byte & 0xF])
          })
          return stringBuilder.toString()
        }
        return null
      }

      this.fromHex = function (hexString) {
        if (hexString && hexString.length > 0 && hexString.length % 2 === 0) {
          let bytes = []
          hexString = hexString.toLowerCase()
          for (let i = 0; i < hexString.length; i += 2) {
            let high = parseInt(hexString[i], 16),
              low = parseInt(hexString[i + 1], 16)
            let val = (high << 4) | low
            if (val > 127) {
              val -= 0xFF
            }
            bytes.push(java.lang.Byte.parseByte(val))
          }
          return bytes
        }
        return null
      }
    }

    function KeyPair (publicKey, privateKey, options) {
      options = Object.assign({}, options || {});
      options.keyPair = 'public';
      this.publicKey = new Key(publicKey, options);
      options.keyPair = 'private';
      this.privateKey = new Key(privateKey, options);
    }

    return $cypto;
  })
}