<template>
    <div class="bottom p-0">
        <div class="content px-3">
            <div
                v-if="step==1"
                id="step1"
            >
                <h4 class="h4 mt-3 font-weight-bold">
                    {{ $t('step_counter',{ 'step_no' : 1}) }}
                </h4>
                <template v-if="createNewWallet">
                    <p
                        v-b-tooltip.hover
                        :title="$t('tooltip_friendly_cta')"
                        class="my-3 font-weight-bold"
                    >
                        {{ $t('friendly_cta') }} &#10068;
                    </p>
                    <input
                        id="inputWallet"
                        v-model="walletname"
                        type="text"
                        class="form-control mb-3"
                        :class="s1c"
                        :placeholder="$t('walletname_placeholder')"
                        required
                        @focus="s1c=''"
                    >
                </template>
                <p
                    v-b-tooltip.hover
                    :title="$t('tooltip_chain_cta')"
                    class="my-3 font-weight-bold"
                >
                    {{ $t('chain_cta') }} &#10068;
                </p>
                <select
                    id="chain-select"
                    v-model="selectedChain"
                    class="form-control mb-3"
                    :class="s1c"
                    :placeholder="$t('chain_placeholder')"
                    required
                >
                    <option
                        selected
                        disabled
                        value="0"
                    >
                        {{ $t('select_chain') }}
                    </option>
                    <option
                        v-for="chain in chainList"
                        :key="chain.identifier"
                        :value="chain.identifier"
                    >
                        {{ (chain.testnet ? "Testnet: " : '') }} {{ chain.name }} ({{ chain.identifier }})
                    </option>
                </select>
                <div v-if="selectedImportOptions.length > 1">
                    <p class="my-3 font-weight-bold">
                        {{ $t('bts_importtype_cta') }}
                    </p>
                    <select
                        id="import-select"
                        v-model="selectedImport"
                        class="form-control mb-3"
                        :class="s1c"
                        :placeholder="$t('import_placeholder')"
                        required
                    >
                        <option
                            selected
                            disabled
                            value="0"
                            key="0"
                        >
                            {{ $t('import_placeholder') }}
                        </option>
                        <option v-for="option in selectedImportOptions" :value="option" :key="option.type">
                            {{ $t(option.translate_key) }}
                        </option>
                    </select>
                </div>
                <div class="row">
                    <div class="col-6">
                        <router-link
                            :to="createNewWallet ? '/' : '/dashboard'"
                            tag="button"
                            class="btn btn-lg btn-secondary btn-block"
                            replace
                        >
                            {{ $t('cancel_btn') }}
                        </router-link>
                    </div>
                    <div class="col-6">
                        <button
                            class="btn btn-lg btn-primary btn-block"
                            type="submit"
                            @click="step2"
                        >
                            {{ $t('next_btn') }}
                        </button>
                    </div>
                </div>
            </div>
            <div
                v-else-if="step==2"
                id="step2"
            >
                <ImportOptions
                    v-if="selectedImportOption"
                    ref="import_accounts"
                    :chain="selectedChain"
                    :type="selectedImportOption.type"
                />

                <div class="row">
                    <div class="col-6">
                        <button
                            class="btn btn-lg btn-secondary btn-block"
                            type="submit"
                            @click="step1"
                        >
                            {{ $t('back_btn') }}
                        </button>
                    </div>
                    <div class="col-6">
                        <button
                            class="btn btn-lg btn-primary btn-block"
                            type="submit"
                            @click="step3"
                        >
                            {{ $t('next_btn') }}
                        </button>
                    </div>
                </div>
            </div>
            <div
                v-else-if="step==3"
                id="step3"
            >
                <h4 class="h4 mt-3 font-weight-bold">
                    {{ $t('step_counter',{ 'step_no' : 3}) }}
                </h4>
                <EnterPassword
                    ref="enterPassword"
                    :get-new="createNewWallet"
                />
                <button
                    class="btn btn-lg btn-primary btn-block"
                    type="submit"
                    @click="addAccounts"
                >
                    {{ $t('next_btn') }}
                </button>
            </div>
            <b-modal
                id="error"
                ref="errorModal"
                centered
                hide-footer
                :title="$t('error_lbl')"
                e
            >
                {{ errorMsg }}
            </b-modal>
        </div>
        <Actionbar v-if="!createNewWallet" />
        <p
            v-if="createNewWallet"
            class="mt-2 mb-2 small"
        >
            &copy; 2019 BitShares
        </p>
    </div>
</template>

<script>
    import { blockchains } from "../config/config.js";
    import getBlockchain from "../lib/blockchains/blockchainFactory";
    import Actionbar from "./actionbar";
    import ImportOptions from "./blockchains/ImportOptions";
    import EnterPassword from "./EnterPassword";

    import { EventBus } from "../lib/event-bus.js";

    import RendererLogger from "../lib/RendererLogger";
    const logger = new RendererLogger();

    export default {
        name: "AddAccount",
        components: { Actionbar, ImportOptions, EnterPassword },
        i18nOptions: { namespaces: "common" },
        data() {
            return {
                walletname: "",
                accountname: "",
                step: 1,
                s1c: "",
                includeOwner: 0,
                errorMsg: "",
                selectedChain: 0,
                selectedImport: 0
            };
        },
        computed: {
            createNewWallet() {
                return !this.$store.state.WalletStore.isUnlocked;
            },
            chainList() {
                return Object.values(blockchains).sort((a, b) => {
                    if (!!a.testnet != !!b.testnet) {
                        return a.testnet ? 1 : -1;
                    }
                    return a.name > b.name;
                });
            },
            selectedImportOptions() {
                if (!this.selectedChain) {
                    return [];
                } else {
                    return getBlockchain(this.selectedChain).getImportOptions();
                }
            },
            selectedImportOption() {
                if (!this.selectedChain) {
                    return null;
                } else {
                    let useImport = null;
                    if (!this.selectedImport) {
                        useImport = this.selectedImportOptions[0];
                    } else {
                        useImport = this.selectedImport;
                    }
                    return getBlockchain(
                        this.selectedChain
                    ).getImportOptions().find(
                        option => { return option.type == useImport.type; }
                    );
                }
            },
        },
        mounted() {
            logger.debug("Account-Add wizard Mounted");
        },
        methods: {
            step1: function() {
                this.step = 1;
            },
            step2: function() {
                if (this.createNewWallet) {
                    if (this.walletname.trim() == "") {
                        this.errorMsg = this.$t("empty_wallet_error");
                        this.$refs.errorModal.show();
                        this.s1c = "is-invalid";
                        return;
                    }
                    // todo use WalletStore
                    let wallets = JSON.parse(localStorage.getItem("wallets"));
                    if (
                        wallets &&
                        wallets.filter(wallet => wallet.name === this.walletname.trim())
                            .length > 0
                    ) {
                        this.errorMsg = this.$t("duplicate_wallet_error");
                        this.$refs.errorModal.show();
                        this.s1c = "is-invalid";
                        return;
                    } else {
                        this.walletname = this.walletname.trim();
                        this.step = 2;
                    }
                } else {
                    this.step = 2;
                }
            },
            step3: async function() {
                EventBus.$emit("popup", "load-start");
                try {
                    getBlockchain(this.selectedChain);
                    // abstract UI concept more
                    this.accounts_to_import = await this.$refs.import_accounts.getAccountEvent();
                    EventBus.$emit("popup", "load-end");
                    if (this.accounts_to_import != null) {
                        // if import accounts are filled, advance to next step. If not, it is a substep in the
                        // import component
                        this.step = 3;
                    }
                } catch (err) {
                    this._handleError(err);
                } finally {
                    EventBus.$emit("popup", "load-end");
                }
            },
            _handleError(err) {
                if (err == "invalid") {
                    this.errorMsg = this.$t("invalid_password");
                } else if (err == "update_failed") {
                    this.errorMsg = this.$t("update_failed");
                } else if (err.key) {
                    this.errorMsg = this.$t(err.key);
                } else {
                    this.errorMsg = err.toString();
                }
                this.$refs.errorModal.show();
            },
            addAccounts: async function() {
                try {
                    let password = this.$refs.enterPassword.getPassword();
                    EventBus.$emit("popup", "load-start");
                    if (this.accounts_to_import) {
                        for (let i in this.accounts_to_import) {
                            let account = this.accounts_to_import[i];
                            if (i == 0 && this.createNewWallet) {
                                await this.$store.dispatch("WalletStore/saveWallet", {
                                    walletname: this.walletname,
                                    password: password,
                                    walletdata: account.account
                                });
                            } else {
                                account.password = password;
                                account.walletname = this.walletname;
                                await this.$store.dispatch("AccountStore/addAccount", account);
                            }
                        }
                        this.$router.replace("/");
                    } else {
                        throw "No account selected!";
                    }
                } catch (err) {
                    this._handleError(err);
                } finally {
                    EventBus.$emit("popup", "load-end");
                }
            }
        }
    };
</script>
