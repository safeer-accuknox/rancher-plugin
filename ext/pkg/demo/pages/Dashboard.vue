<template>
  <div class="container p-4">
    <h1 class="text-xl font-semibold mb-4">Clusters</h1>

    <ul class="mb-4">
      <li v-for="cluster in clusters" :key="cluster.id">
        {{ cluster.nameDisplay || cluster.id }}
      </li>
    </ul>

    <button class="btn role-primary" @click="installReposForAllClusters">
      Install Repos to All Clusters
    </button>

    <div v-if="message" class="mt-4 text-green-600">
      {{ message }}
    </div>
  </div>
</template>

<script>
import { CATALOG, MANAGEMENT } from '@shell/config/types';

export default {
  data() {
    return {
      clusters: [],
      message: ''
    };
  },

  async mounted() {
    try {
      const res = await this.$store.dispatch('management/findAll', {
        type: MANAGEMENT.CLUSTER,
      });
      this.clusters = res || [];
    } catch (e) {
      console.error('❌ Failed to load clusters:', e);
    }
  },

  methods: {
    async installRepos(clusterId) {
      const name = 'accuknox-charts';
      const opt = { cluster: clusterId };

      try {
        const cluster = await this.$store.dispatch('management/find', { type: MANAGEMENT.CLUSTER, id: clusterId });
        const allRepos = await this.$store.dispatch('management/findAll', { type: CATALOG.CLUSTER_REPO }, { force: true });

        const exists = allRepos.find(r => r.metadata?.name === name);
        if (exists) {
          console.log(`ℹ️ Repo already exists in ${clusterId}`);
          return;
        }

        // Create repo
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
        console.error(`❌ Failed to install repo in ${clusterId}`, e);
      }
    },

    async installReposForAllClusters() {
      for (const cluster of this.clusters) {
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
</style>
