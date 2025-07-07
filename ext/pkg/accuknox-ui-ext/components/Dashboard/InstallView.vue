<template>
  <div>
    <!-- Show "Installed" if installComplete -->
    <div v-if="installComplete" class="text-green-600 font-semibold p-4">
      ✅ AccuKnox Installed Successfully
    </div>

    <!-- Show buttons otherwise -->
    <div v-else>
      <!-- <button class="btn role-primary" :disabled="isInstalling" @click="openModalWithDefaults">
        <span v-if="isInstalling">
          <span class="spinner" /> Installing...
        </span>
        <span v-else>
          Install Now
        </span>
      </button> -->

      <!-- New buttons for separate actions -->
      <div class="mt-4">
        <button
          v-if="!allReposPresent"
          class="btn role-primary mr-2"
          :disabled="isInstalling"
          @click="installReposOnly"
        >
          Install Repos
        </button>
        <button v-else class="btn role-secondary" :disabled="isInstalling" @click="openModalWithDefaults">
          Install Charts
        </button>
      </div>

      <!-- Modal -->
      <div v-if="showModal" class="modal-overlay">
        <div class="modal-content">
          <h2>AccuKnox Agent Configuration</h2>

          <label>Access Key</label>
          <input required v-model="form.accessKey" class="input" placeholder="Enter Access Key" />

          <label>Cluster Name</label>
          <input required v-model="form.clusterName" class="input" placeholder="Cluster Name" />

          <label class="mt-4">Token URL</label>
          <input required v-model="form.tokenURL" class="input" placeholder="cwpp.demo.accuknox.com" />

          <label class="mt-4">Spire Host</label>
          <input required v-model="form.spireHost" class="input" placeholder="spire.demo.accuknox.com" />

          <label class="mt-4">PPS Host</label>
          <input required v-model="form.ppsHost" class="input" placeholder="pps.demo.accuknox.com" />

          <label class="mt-4">Knox Gateway</label>
          <input required v-model="form.knoxGateway" class="input" placeholder="knox-gw.demo.accuknox.com:3000" />

          <label class="mt-4">Enable Admission Controller</label>
          <input type="checkbox" v-model="form.admissionController" />

          <label class="mt-4">Enable Kyverno</label>
          <input type="checkbox" v-model="form.kyverno" />

          <div class="mt-6">
            <button class="btn role-primary" @click="installChartsOnly">
              Install
            </button>
            <button class="btn ml-2" @click="showModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { CATALOG, NAMESPACE } from '@shell/config/types';
import { handleGrowl } from '../../utils/handle-growl';

export default {
  data() {
    return {
      form: {
        accessKey: '', clusterName: '', tokenURL: '', spireHost: '', ppsHost: '', knoxGateway: '',
        admissionController: false, kyverno: false
      },
      showModal: false,
      isInstalling: false,
      installComplete: false,
      url: window.location.origin,
    };
  },
  computed: {
    allReposPresent() {
      const allRepos = this.$store.getters['cluster/all']('catalog.cattle.io.clusterrepo');
      const requiredRepos = this.getInstallConfig().map(r => r.name);
      return requiredRepos.every(repoName => allRepos.some(r => r.metadata?.name === repoName));
    }
  },
  methods: {
    openModalWithDefaults() {
      this.form = {
        accessKey: '', clusterName: this.clusterId,
        tokenURL: 'cwpp.demo.accuknox.com', spireHost: 'spire.demo.accuknox.com',
        ppsHost: 'pps.demo.accuknox.com', knoxGateway: 'knox-gw.demo.accuknox.com:3000',
        admissionController: false, kyverno: false
      };
      this.showModal = true;
    },

    getInstallConfig() {
      return [
        {
          name: 'kubearmor-charts',
          url: 'https://kubearmor.github.io/charts/',
          chartName: 'kubearmor-operator',
          version: 'v1.5.7',
          installAfter: true,
          namespace: 'kubearmor',
          values: { autoDeploy: true }
        },
        {
          name: 'accuknox-agents',
          url: 'oci://public.ecr.aws/k9v9d5v2/agents-chart',
          chartName: 'agents-chart',
          version: 'v0.10.5',
          installAfter: true,
          namespace: 'agents',
          values: {
            clusterName: this.form.clusterName,
            accessKey: this.form.accessKey,
            spireHost: this.form.spireHost,
            tokenURL: this.form.tokenURL,
            ppsHost: this.form.ppsHost,
            knoxGateway: this.form.knoxGateway,
            admissionController: { enabled: this.form.admissionController },
            kyverno: { enabled: this.form.kyverno },
          }
        }
      ];
    },

    async createNamespace(ns) {
      const allNamespaces = this.$store.getters['cluster/all'](NAMESPACE);
      if (!allNamespaces.find(n => n?.metadata?.name === ns)) {
        const nsResource = await this.$store.dispatch('cluster/create', {
          type: NAMESPACE,
          metadata: { name: ns },
        });
        await nsResource.save();
      }
    },

    async fetch() {
      this.repos = await this.$fetchType(CATALOG.CLUSTER_REPO);
    },

    async installRepos(REPOS) {
      const CLUSTER_REPO_TYPE = 'catalog.cattle.io.clusterrepo';
      const allRepos = this.$store.getters['cluster/all'](CLUSTER_REPO_TYPE);

      for (const repo of REPOS) {
        const { name, url, namespace } = repo;
        await this.createNamespace(namespace);

        if (!allRepos.find(r => r.metadata?.name === name)) {
          try {
            const repoObj = await this.$store.dispatch('cluster/create', {
              type: CLUSTER_REPO_TYPE,
              metadata: { name },
              spec: { url, forceUpdate: 'true' }
            });
            await repoObj.save();
            await new Promise(r => setTimeout(r, 3000));
          } catch (e) {
            handleGrowl({ error: e, store: this.$store });
          }
        }
      }
    },

    async installCharts(REPOS) {
      for (const repo of REPOS) {
        if (!repo.installAfter) continue;
        const { name, chartName, version, namespace, values } = repo;

        try {
          const data = {
            charts: [
              {
                chartName,
                version,
                releaseName: chartName,
                annotations: {
                  'catalog.cattle.io/ui-source-repo-type': 'cluster',
                  'catalog.cattle.io/ui-source-repo': name
                },
                values: {
                  ...values,
                  global: {
                    cattle: {
                      clusterId: this.clusterId,
                      clusterName: this.clusterName,
                      systemProjectId: this.systemProjectId,
                      url: this.url
                    }
                  }
                }
              }
            ],
            namespace,
            projectId: this.projectId,
            timeout: '600s',
            wait: true
          };

          await this.$store.dispatch('cluster/request', {
            url: `v1/catalog.cattle.io.clusterrepos/${name}?action=install`,
            method: 'POST',
            data
          });
        } catch (e) {
          handleGrowl({ error: e, store: this.$store });
        }
      }
    },

    async installReposOnly() {
      this.isInstalling = true;
      await this.installRepos(this.getInstallConfig());
      this.isInstalling = false;
    },

    async installChartsOnly() {
      this.isInstalling = true;
      await this.installCharts(this.getInstallConfig());
      this.isInstalling = false;
    },

    async deploy() {
      this.isInstalling = true;
      this.showModal = false;
      const REPOS = this.getInstallConfig();
      await this.installRepos(REPOS);
      await this.installCharts(REPOS);
      this.isInstalling = false;
      this.installComplete = true;
    },
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  min-width: 400px;
  text-align: center;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
}
.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
