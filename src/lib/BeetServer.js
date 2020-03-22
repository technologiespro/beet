import BeetAPI from './BeetAPI';
import BeetWS from './BeetWS';
import CryptoJS from 'crypto-js';
import store from '../store/index.js';
import { ec as EC } from "elliptic";
import RendererLogger from "./RendererLogger";

let ec = new EC('curve25519');
const logger = new RendererLogger();
let vueInst = null;

const _calculateIdentityHash = function (request, chain, id) {
    return CryptoJS.SHA256(request.browser + ' ' + request.origin + ' ' + request.appName + ' ' + chain + ' ' + id).toString();
};

const _findApp = function (identityhash) {
    let apps = store.state.OriginStore.apps.filter(x => x.identityhash == identityhash);
    // must be unique
    if (apps.length !== 1) {
        return null;
    }
    return apps[0];
};

const linkHandler = async (req) => {
    try {
        // todo: only forward fields that are actually used in handler
        let userResponse = await BeetAPI.handler(Object.assign(req, {}), vueInst);
        
        if (!!userResponse.response && !userResponse.response.isLinked) {
            return {
                id: req.id,
                result: {
                    isError: true,
                    error: 'User rejected request'
                }
            };
        }
        
        let identityhash = _calculateIdentityHash(req, userResponse.chain, userResponse.identity.id);
        let app = _findApp(identityhash);
        let existing = !!app;
        console.log('relink: ');
        console.log(userResponse);
        if (userResponse.identity.identityhash==identityhash){
            existing=false;
            let secret = req.key.derive(ec.keyFromPublic(req.payload.pubkey, 'hex').getPublic());
            app = await store.dispatch('OriginStore/addApp', {
                appName: req.appName,
                identityhash: userResponse.identity.identityhash,
                origin: req.origin,
                account_id: userResponse.identity.id,
                chain: userResponse.identity.chain,
                secret: secret.toString(16),
                next_hash: req.payload.next_hash
            });
            // todo: check if setting the next two is necessary
            app.secret = secret.toString(16);
            app.next_hash = req.payload.next_hash;
        }else{
            if (!existing) {
                // link this new application
                let secret = req.key.derive(ec.keyFromPublic(req.payload.pubkey, 'hex').getPublic());
                app = await store.dispatch('OriginStore/addApp', {
                    appName: req.appName,
                    identityhash: identityhash,
                    origin: req.origin,
                    account_id: userResponse.identity.id,
                    chain: userResponse.identity.chain,
                    secret: secret.toString(16),
                    next_hash: req.payload.next_hash
                });
                // todo: check if setting the next two is necessary
                app.secret = secret.toString(16);
                app.next_hash = req.payload.next_hash;
            }
        }
        // todo: why copy content of request?
        return Object.assign(req, {
            isLinked: true, // todo: can this also be called link?
            identityhash: identityhash,
            app: app,
            existing: existing
        });
    } catch (err) {
        return {
            id: req.id,
            result: {
                isError: true,
                error: 'Error occurred: ' + err
            }
        };
    }
};

const authHandler = function (req) {
    let linked = req.payload.identityhash != null & req.payload.identityhash != undefined;
    // TODO: Check against blacklist;
    const app = _findApp(req.payload.identityhash);
    if (!linked) {
        return Object.assign(req.payload, {
            authenticate: true,
            link: false
        });
    } else if (!app) {
        return Object.assign(req.payload, {
            authenticate: false,
            link: false
        });
    } else {
        if (req.payload.origin == app.origin && req.payload.appName == app.appName) {
            return Object.assign(req.payload, {
                authenticate: true,
                link: true,
                app: app
            });
        } else {
            return Object.assign(req.payload, {
                authenticate: false,
                link: false
            });
        }
    }
};

export default class BeetServer {

    static initialize(vue) {
        vueInst = vue;
        const server = new BeetWS(60555, 60556, 10000);
        server.on('link', async (data) => {
            logger.debug("incoming link request", data);
            let status = await linkHandler(data);
            server.respondLink(data.client, status);
        }); 
        server.on('relink', async (data) => {
            logger.debug("incoming relink request", data);
            let status = await linkHandler(data);
            server.respondReLink(data.client, status);
        });
        server.on('authenticate', async (data) => {
            logger.debug("incoming authenticate request", data);
            let status = await authHandler(data);
            status.id = data.id;
            server.respondAuth(data.client, status);
        });
        server.on('api', async (data) => {
            logger.debug("incoming api request", data);
            store.dispatch('OriginStore/newRequest', {
                identityhash: data.payload.identityhash,
                next_hash: data.payload.next_hash
            });
            let status = await BeetAPI.handler(data, vueInst);
            status.id = data.id;
            server.respondAPI(data.client, status);
        });
    }

}