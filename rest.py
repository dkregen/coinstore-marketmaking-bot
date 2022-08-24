from flask import Flask, jsonify, request, make_response
import hashlib
import hmac
import json
import math
import time
import requests

# ENVIRONMENT
API_URL = 'https://api.coinstore.com/api'
WS_URL = 'wss://ws.biki.com/kline-api/ws'
API_KEY = '570574a654ceee6cb4b7176d2ffa59de'
SECRET_KEY = '732075c0818ef3b21cc5ed65bc85c0a1'

# METHOD
GET = "GET"
POST = "POST"
DELETE = "DELETE"

APPLICATION_FORM = 'application/x-www-form-urlencoded'
CONTENT_TYPE = 'Content-Type'

app = Flask(__name__)
app.config["DEBUG"] = True


def get_header():
    header = dict()
    header[CONTENT_TYPE] = APPLICATION_FORM
    return header


def get_timestamp():
    timestamp = int(time.time() * 1000)
    return timestamp


def parse_params_to_str(params):
    url = '?'
    for key, value in params.items():
        url = url + str(key) + '=' + str(value) + '&'
    return url[0:-1]


class Coinstore:
    def __init__(self, config={}):
        self.api_key = API_KEY
        self.secret = SECRET_KEY
        self.api_url = API_URL
        for key, value in config.items():
            setattr(self, key, value)

    def _get_sign(self, params, method):
        expires = int(time.time() * 1000)
        print('expires:', expires)
        expires_key = str(math.floor(expires / 30000))
        expires_key = expires_key.encode("utf-8")
        print('expires_key:', expires_key)
        secret_key = self.secret.encode("utf-8")
        print('secret_key:', secret_key)
        key = hmac.new(secret_key, expires_key, hashlib.sha256).hexdigest()
        key = key.encode("utf-8")
        params['timestamp'] = expires
        print(params)
        print('key:', key)

        if method == GET:
            params = parse_params_to_str(params)
            params = params[1:]
        else:
            params = json.dumps(params)

        payload = params.encode("utf-8")
        print('payload:', payload)
        signature = hmac.new(key, payload, hashlib.sha256).hexdigest()
        print('signature:', signature)
        header = {
            "X-CS-APIKEY": self.api_key,
            "X-CS-EXPIRES": str(expires),
            "X-CS-SIGN": signature,
            'Content-Type': 'application/json',
        }

        return expires, signature, header

    def request(self, method, request_path, params, sign_flag=True):
        header = get_header()
        if sign_flag:
            expires, sign, header = self._get_sign(params, method)
            print(expires, sign, header)

        if method == GET:
            request_path = request_path + parse_params_to_str(params)

        url = self.api_url + request_path
        body = params if method == POST else {}
        print('url', url)

        response = None
        if method == GET:
            response = requests.get(url, headers=header)
        elif method == POST:
            response = requests.post(url, data=json.dumps(body), headers=header)
        elif method == DELETE:
            response = requests.delete(url, headers=header)

        # exception handle
        if not str(response.status_code).startswith('2'):
            raise response.json()

        return response.json()


@app.route('/', methods=['GET'])
def index():

    method = request.args.get('method')
    data = json.loads(request.args.get('data'))
    request_path = request.args.get('path')

    print(method, data, request_path)

    ex = Coinstore()
    results = ex.request(method=method, params=data, request_path=request_path)
    return make_response(jsonify(results), 200)


app.run()
