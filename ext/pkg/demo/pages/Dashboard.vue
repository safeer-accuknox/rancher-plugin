<template>
  <div class="container p-4">
    <h1 class="text-xl font-semibold mb-4">Clusters</h1>

    <ul class="mb-4">
      <li v-for="cluster in clusterDetails" :key="cluster.id">
        {{ cluster.id }}
      </li>
    </ul>

    <table class="table-auto w-full mb-6 border">
      <thead>
        <tr class="bg-gray-100">
          <th class="px-4 py-2 border">Cluster</th>
          <th class="px-4 py-2 border">Repo Status</th>
          <th class="px-4 py-2 border">Chart Ready</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cluster in clusterDetails" :key="cluster.id">
          <td class="px-4 py-2 border">{{ cluster.id }}</td>
          <td class="px-4 py-2 border">
            <span v-if="cluster.allReposPresent">✅ Installed</span>
            <span v-else>❌ Not Installed</span>
          </td>
          <td class="px-4 py-2 border">
            <span v-if="cluster.allChartsPresent">✅ Ready</span>
            <span v-else>❌ Not Ready</span>
          </td>
        </tr>
      </tbody>
    </table>

    <button class="btn role-primary" @click="installReposForAllClusters">
      Install Repos to All Clusters
    </button>

    <button
      class="btn role-secondary mt-4"
      :disabled="isInstalling"
      @click="openModalWithDefaults"
    >
      Install Charts
    </button>

    <div v-if="showModal" class="modal-overlay">
      <div class="modal-content">
        <h2 class="text-lg font-bold mb-4">AccuKnox Agent Configuration</h2>

        <label>Access Key</label>
        <input v-model="form.accessKey" class="input" placeholder="Enter Access Key" />

        <label class="mt-4">Cluster Name Prefix</label>
        <input v-model="form.clusterNamePrefix" class="input" placeholder="Cluster Name Prefix" />

        <label class="mt-4">Token URL</label>
        <input v-model="form.tokenURL" class="input" placeholder="cwpp.demo.accuknox.com" />

        <label class="mt-4">Spire Host</label>
        <input v-model="form.spireHost" class="input" placeholder="spire.demo.accuknox.com" />

        <label class="mt-4">PPS Host</label>
        <input v-model="form.ppsHost" class="input" placeholder="pps.demo.accuknox.com" />

        <label class="mt-4">Knox Gateway</label>
        <input v-model="form.knoxGateway" class="input" placeholder="knox-gw.demo.accuknox.com:3000" />

        <label class="mt-4 block">Enable Admission Controller</label>
        <input type="checkbox" v-model="form.admissionController" />

        <label class="mt-4 block">Enable Kyverno</label>
        <input type="checkbox" v-model="form.kyverno" />

        <div class="mt-6">
          <button class="btn role-primary" @click="installCharts">Install</button>
          <button class="btn ml-2" @click="showModal = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { CATALOG, MANAGEMENT } from '@shell/config/types';
import { handleGrowl } from '../utils/handle-growl';

export default {
  data() {
    return {
      clusterDetails: [],
      clusters: [],
      message: '',
      form: {
        accessKey: '',
        clusterName: '',
        tokenURL: '',
        spireHost: '',
        ppsHost: '',
        knoxGateway: '',
        admissionController: false,
        kyverno: false
      },
      showModal: false,
      isInstalling: false,
    };
  },

  async mounted() {
    try {
      const res = await this.$store.dispatch('management/findAll', {
        type: MANAGEMENT.CLUSTER,
      });
      const clusters = res || [];
      const clusterDetails = []
      for (const cluster of clusters) {
        await this.$store.dispatch('management/find', { type: MANAGEMENT.CLUSTER, id: cluster.id });
        const allRepos = await this.$store.dispatch('management/findAll', { type: CATALOG.CLUSTER_REPO }, { force: true });
        const allReposPresent = this.checkAllReposPresent(allRepos);

        let allChartsPresent = false
        if (allReposPresent) {
          allChartsPresent = await this.checkChartAvailability(cluster.id);
        }

        clusterDetails.push({
          id: cluster.id,
          name: cluster.clusterName,
          systemProjectId: cluster.systemProjectId,
          repos: allRepos,
          allReposPresent: allReposPresent,
          allChartsPresent: allChartsPresent,
        });
      }
      this.clusterDetails = clusterDetails

    } catch (e) {
      handleGrowl({ error: e, store: this.$store });
    }
  },

  methods: {
    checkAllReposPresent(allRepos) {
      const requiredRepo = 'accuknox-charts';
      return allRepos.some(r => r.metadata?.name === requiredRepo);
    },
    async checkChartAvailability(clusterId) {
      const repoName = 'accuknox-charts'
      try {
          const response = await this.$store.dispatch('cluster/request', {
            url: `v1/catalog.cattle.io.clusterrepos/${repoName}?link=index`,
            method: 'GET',
            headers: {
              'x-api-c-cluster': clusterId
            }
          });
        return !!response?.entries;
      } catch {
        return false;
      }
    },
    openModalWithDefaults() {
      this.form = {
        accessKey: '',
        clusterName: '',
        tokenURL: 'cwpp.demo.accuknox.com',
        spireHost: 'spire.demo.accuknox.com',
        ppsHost: 'pps.demo.accuknox.com',
        knoxGateway: 'knox-gw.demo.accuknox.com:3000',
        admissionController: false,
        kyverno: false
      };
      this.showModal = true;
    },

    getInstallConfig(clusterName) {
      return [
        {
          name: 'accuknox-charts',
          chartName: 'kubearmor-operator',
          version: 'v1.5.7',
          namespace: 'kubearmor',
          values: { autoDeploy: true }
        },
        {
          name: 'accuknox-charts',
          chartName: 'agents-chart',
          version: 'v0.10.5',
          namespace: 'agents',
          values: {
            clusterName: `${this.form.clusterNamePrefix}${clusterName}`,
            accessKey: this.form.accessKey,
            spireHost: this.form.spireHost,
            tokenURL: this.form.tokenURL,
            ppsHost: this.form.ppsHost,
            knoxGateway: this.form.knoxGateway,
            admissionController: { enabled: this.form.admissionController },
            kyverno: { enabled: this.form.kyverno }
          }
        }
      ];
    },

    async installCharts() {
      this.showModal = false;
      this.isInstalling = true;

      for (const cluster of this.clusterDetails) {
        const charts = this.getInstallConfig(cluster.id);

        for (const chart of charts) {
          const data = {
            charts: [
              {
                chartName: chart.chartName,
                version: chart.version,
                releaseName: chart.chartName,
                annotations: {
                  'catalog.cattle.io/ui-source-repo-type': 'cluster',
                  'catalog.cattle.io/ui-source-repo': chart.name
                },
                values: {
                  ...chart.values,
                  global: {
                    cattle: {
                      clusterId: cluster.id,
                      clusterName: cluster.name,
                      systemProjectId: cluster.systemProjectId,
                      url: this.url
                    }
                  }
                }
              }
            ],
            namespace: chart.namespace,
            projectId: cluster.projectId,
            timeout: '600s',
            wait: true
          };

          try {
            await this.$store.dispatch('cluster/request', {
              url: `v1/catalog.cattle.io.clusterrepos/${chart.name}?action=install`,
              method: 'POST',
              data
            });
          } catch (e) {
            handleGrowl({ error: e, store: this.$store });
          }
        }
      }

      

      this.isInstalling = false;
    },

    async installRepos(clusterId) {
      const name = 'accuknox-charts';
      const opt = { cluster: clusterId };

      try {
        await this.$store.dispatch('management/find', { type: MANAGEMENT.CLUSTER, id: clusterId });
        const allRepos = await this.$store.dispatch('management/findAll', { type: CATALOG.CLUSTER_REPO }, { force: true });

        const exists = allRepos.find(r => r.metadata?.name === name);
        if (exists) {
          console.log(`ℹ️ Repo already exists in ${clusterId}`);
          return;
        }

        const repo = await this.$store.dispatch('management/create', {
          type: CATALOG.CLUSTER_REPO,
          metadata: { name },
          spec: {
            url: 'http://demo-svc.cattle-ui-plugin-system:8080/charts',
            forceUpdate: 'true',
          },
        });

        await repo.save();
        console.log(`✅ Repo installed in ${clusterId}`);
      } catch (e) {
        handleGrowl({ error: e, store: this.$store });
      }
    },

    async installReposForAllClusters() {
      for (const cluster of this.clusterDetails) {
        await this.installRepos(cluster.id);
      }
    },
  },
};
</script>

<style scoped>
.btn {
  background-color: #006aff;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
}
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
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
.input {
  width: 100%;
  padding: 8px;
  margin-top: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
