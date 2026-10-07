"""Trust boundaries and the website's small public method surface."""
import re
from urllib.parse import urlsplit


def trusted_origin(origin):
    return origin == 'https://steambalance.cc'


def allowed_url(url, hosts):
    try:
        parsed = urlsplit(url)
        return (parsed.scheme == 'https' and parsed.hostname in hosts
                and parsed.port in {None, 443} and not parsed.username and not parsed.password)
    except (ValueError, TypeError):
        return False


def host_call(method, args):
    args = args if isinstance(args, list) else []
    if method == 'getSteamId':
        return 'hostAccount', ['getSteamId']
    if method == 'getRateAccountData':
        return 'rateAccountData', []
    if method == 'getStoreCountry' and args and isinstance(args[0], str) and re.fullmatch(r'[0-9]{17}', args[0]):
        return 'hostAccount', ['getStoreCountry', args[0]]
    if method == 'activateKey' and args and isinstance(args[0], str) and 1 <= len(args[0]) <= 256:
        return 'keysActivate', [args[0]]
    if method == 'purchaseKey' and args and type(args[0]) is int and 0 < args[0] <= 9007199254740991:
        options = args[1] if len(args) > 1 and isinstance(args[1], dict) else {}
        name = options.get('gameName')
        name = name[:150] if isinstance(name, str) else None
        if 'email' in options:
            email = options['email']
            if not isinstance(email, str) or len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                raise ValueError('invalid email')
            return 'keysPurchaseEmail', [args[0], name, email]
        return 'keysPurchase', [args[0], name]
    raise ValueError('unsupported method or invalid arguments')
