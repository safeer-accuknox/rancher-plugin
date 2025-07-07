<script>
import { mapGetters } from 'vuex';

import { CATALOG, SERVICE } from '@shell/config/types';
import { NAMESPACE } from '@shell/config/types';
import { REPO_TYPE, REPO, CHART, VERSION } from '@shell/config/query-params';
import { allHash } from '@shell/utils/promise';
import ResourceFetch from '@shell/mixins/resource-fetch';

import { Banner } from '@components/Banner';

import { ACCUKNOX_CHARTS } from '../../types/accuknox';
import { getLatestStableVersion } from '../../plugins/accuknox-class';
import { handleGrowl } from '../../utils/handle-growl';
import { refreshCharts } from '../../utils/chart';

export default {
  props: {
    uiService: {
      type:     Object,
      default:  () => {}
    }
  },

  components: {
    Banner,
  },

  mixins: [ResourceFetch],

  async fetch() {
    this.clusterId = this.$store.getters['clusterId'];
    this.clusterName = this.$store.getters['currentCluster']?.nameDisplay;
    this.url = window.location.origin;

    await this.$fetchType('management.cattle.io.project');
    const allProjects = this.$store.getters['management/all']('management.cattle.io.project');
    const clusterProjects = allProjects.filter(p => p.spec?.clusterName === this.clusterId);

    this.projectId = `${this.clusterId}/${clusterProjects[0].metadata.name}`
    this.systemProjectId = clusterProjects[1].metadata.name
  },

  data() {
    return {
      form: {
        accessKey: '',
        spireHost: '',
        tokenURL: '',
        clusterName: '',
        ppsHost: '',
        knoxGateway: '',
        admissionController: false,
        kyverno: false,
      },
      showModal: false,
      isInstalling: false,
      reloadReady: false,
      install: false,
      installComplete: false, 
    }
  },

  computed: {
    ...mapGetters(['currentCluster']),
    ...mapGetters({
      charts: 'catalog/charts', repos: 'catalog/repos', t: 'i18n/t'
    }),

    controllerChart() {
      if (this.accuknxoRepo) {
        return this.$store.getters['catalog/chart']({
          repoName: this.accuknxoRepo.id,
          repoType: 'cluster',
          chartName: ACCUKNOX_CHARTS.AGENTS
        });
      }
      return null;
    },

    accuknxoRepo() {
      const chart1 = this.charts?.find(chart => chart.chartName === ACCUKNOX_CHARTS.AGENTS);
      return this.repos?.find(repo => repo.id === chart1?.repoName);
    },
  },

  methods: {
    openModalWithDefaults() {
      this.form = {
        accessKey: '',
        clusterName: this.clusterId,
        tokenURL: 'cwpp.demo.accuknox.com',
        spireHost: 'spire.demo.accuknox.com',
        ppsHost: 'pps.demo.accuknox.com',
        knoxGateway: 'knox-gw.demo.accuknox.com:3000',
        admissionController: false,
        kyverno: false
      };
      this.showModal = true;
    },
    async createNamespace(ns) {
      const allNamespaces = this.$store.getters['cluster/all'](NAMESPACE);
      const nsTemplate = {
        type: NAMESPACE,
        metadata: { name: ns },
        disableOpenApiValidation: false
      };

      const existing = allNamespaces?.find(n => n?.metadata?.name === ns);
      if (!existing) {
        const nsResource = await this.$store.dispatch('cluster/create', nsTemplate);
        try {
          await nsResource.save();
        } catch (e) {
          this.errors.push(e);
        }
      }
    },

    async deploy() {
      this.isInstalling = true;
      this.showModal = false;

      const CLUSTER_REPO_TYPE = 'catalog.cattle.io.clusterrepo';
      const REPOS = [
        {
          name: 'kubearmor-charts',
          url: 'https://kubearmor.github.io/charts/',
          chartName: 'kubearmor-operator',
          version: 'v1.5.7',
          installAfter: true,
          namespace: 'kubearmor',
          values: {
            autoDeploy: true
          }
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

      console.log("TEST", this.url)


      await this.$fetchType(CATALOG.CLUSTER_REPO);
      const allRepos = this.$store.getters['cluster/all'](CLUSTER_REPO_TYPE);

      for (const repo of REPOS) {
        const { name, url, chartName, version, installAfter, namespace, values } = repo;
        await this.createNamespace(namespace);
        const found = allRepos.find(r => r.metadata?.name === name);

        if (!found) {
          try {
            const repoObj = await this.$store.dispatch('cluster/create', {
              type: CLUSTER_REPO_TYPE,
              metadata: { name },
              spec: { url, forceUpdate: 'true' }
            });

            await repoObj.save();
            await new Promise(r => setTimeout(r, 5000));
            
            const chartRefreshData = {
              "id": name,
              "type": "catalog.cattle.io.clusterrepo",
              "actions": {
                "install": `${this.url}/v1/catalog.cattle.io.clusterrepos/${name}?action=install`,
                "upgrade": `${this.url}/v1/catalog.cattle.io.clusterrepos/${name}?action=upgrade`
              },
              "apiVersion": "catalog.cattle.io/v1",
              "kind": "ClusterRepo",
              "metadata": {
                "fields": [
                  name,
                  url
                ],
                "name": name,
              },
              "spec": {
                "url": url
              }
            }
             
            await this.$store.dispatch('cluster/request', {
              url: `v1/catalog.cattle.io.clusterrepos/${name}`,
              method: 'PUT',
              data: chartRefreshData
            });

            await new Promise(r => setTimeout(r, 5000));
          } catch (e) {
            handleGrowl({ error: e, store: this.$store });
            continue;
          }
        }

        if (installAfter) {
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
                        url: this.url,
                        rkePathPrefix: '',
                        rkeWindowsPathPrefix: ''
                      }
                    }
                  }
                }
              ],
              namespace,
              projectId: this.projectId,
              noHooks: false,
              timeout: '600s',
              wait: true,
              disableOpenAPIValidation: false,
              skipCRDs: false
            };

            await this.$store.dispatch('cluster/request', {
              url: `v1/catalog.cattle.io.clusterrepos/${name}?action=install`,
              method: 'POST',
              data
            });
            await new Promise(r => setTimeout(r, 5 * 60 * 1000)); // 5 minutes
            
          } catch (e) {
            handleGrowl({ error: e, store: this.$store });
            continue;

          }
        }
      }

      handleGrowl({
        type: 'Success',
        store: this.$store,
        error: {
          _statusText: 'Success',
          message: 'AccuKnox agents installed successfully.'
        }
      });
      this.isInstalling = false;
      this.showModal = false;
      this.installComplete = true; 
    }
  }
};
</script>

<template>
      <!-- Show "Installed" if installComplete -->
      <div v-if="installComplete" class="text-green-600 font-semibold p-4">
        ✅ AccuKnox Installed Successfully
      </div>

      <!-- Show button otherwise -->
      <div v-else>
        <div>
          <button class="btn role-primary" :disabled="isInstalling" @click="openModalWithDefaults">
            <span v-if="isInstalling">
              <span class="spinner" /> Installing...
            </span>
            <span v-else>
              Install Now
            </span>
          </button>



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
                <button class="btn role-primary" @click="deploy">
                  Install
                </button>
                <button class="btn ml-2" @click="showModal = false">Cancel</button>
              </div>
            </div>
          </div>
        </div>

      </div>
</template>

<style lang="scss" scoped>
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
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
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
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}



</style>