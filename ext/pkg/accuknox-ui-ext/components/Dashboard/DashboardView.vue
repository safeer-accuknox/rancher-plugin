<template>
  <div class="p-20">
    <h2 class="text-xl font-bold mb-4">Install AccuKnox Agents</h2>

    <form @submit.prevent="install">
      <div class="mb-4">
        <label>Join Token</label>
        <input v-model="joinToken" type="text" class="input" required />
      </div>
      <div class="mb-4">
        <label>Spire Host</label>
        <input v-model="spireHost" type="text" class="input" required />
      </div>
      <div class="mb-4">
        <label>PPS Host</label>
        <input v-model="ppsHost" type="text" class="input" required />
      </div>
      <div class="mb-4">
        <label>Knox Gateway</label>
        <input v-model="knoxGateway" type="text" class="input" required />
      </div>

      <button type="submit" class="btn role-primary">Install</button>
    </form>
  </div>
</template>

<script>
export default {
  data() {
    return {
      joinToken: '',
      spireHost: '',
      ppsHost: '',
      knoxGateway: '',
    };
  },
  methods: {
    async install() {
      const namespace = 'agents';
      const chartName = 'agents';
      const repoUrl = 'oci://public.ecr.aws/k9v9d5v2/agents-chart';
      const version = 'v0.10.0';

      const values = {
        joinToken: this.joinToken,
        spireHost: this.spireHost,
        ppsHost: this.ppsHost,
        knoxGateway: this.knoxGateway,
        admissionController: { enabled: false },
        kyverno: { enabled: false }
      };

      try {
        await this.$store.dispatch('cluster/helm/installChart', {
          namespace,
          releaseName: chartName,
          repoType: 'oci',
          chartName,
          repo: repoUrl,
          version,
          values,
          createNamespace: true,
        });

        this.$store.dispatch('growl/success', {
          title: 'Installation started',
          message: `Installing ${chartName} in namespace ${namespace}`
        });
      } catch (e) {
        this.$store.dispatch('growl/error', {
          title: 'Installation failed',
          message: e.message
        });
      }
    }
  }
};
</script>
