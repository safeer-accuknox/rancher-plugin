<template>
  <div class="install-container">
    <h2>Install AccuKnox Agent</h2>
    
    <label class="label" for="joinToken">Join Token</label>
    <input
      v-model="joinToken"
      id="joinToken"
      class="input"
      type="text"
      placeholder="Enter your Join Token"
    />

    <button
      class="btn btn-primary mt-10"
      :disabled="!joinToken || installing"
      @click="installAgent"
    >
      {{ installing ? 'Installing...' : 'Install Agent' }}
    </button>

    <div v-if="installSuccess" class="success-msg mt-10">
      ✅ Agent installed successfully.
    </div>
    <div v-if="installError" class="error-msg mt-10">
      ❌ {{ installError }}
    </div>
  </div>
</template>

<script>
export default {
  props: {
    uiService: {
      type: Object,
      default: () => null
    }
  },

  data() {
    return {
      joinToken: '',
      installing: false,
      installSuccess: false,
      installError: null,
    };
  },

  methods: {
    async installAgent() {
      this.installing = true;
      this.installSuccess = false;
      this.installError = null;

      try {
        const clusterId = this.$store.getters['currentCluster'].id;

        const command = [
          'helm', 'upgrade', '--install', 'agents', 'oci://public.ecr.aws/k9v9d5v2/agents-chart',
          '--version', 'v0.10.0',
          `--set`, `joinToken=${this.joinToken}`,
          `--set`, `spireHost=spire.demo.accuknox.com`,
          `--set`, `ppsHost=pps.demo.accuknox.com`,
          `--set`, `knoxGateway=knox-gw.demo.accuknox.com:3000`,
          `--set`, `admissionController.enabled=false`,
          `--set`, `kyverno.enabled=false`,
          '--namespace', 'agents',
          '--create-namespace'
        ];

        await this.$store.dispatch('cluster/execKubectl', {
          command,
          cluster: clusterId,
        }, { root: true });

        this.installSuccess = true;
      } catch (e) {
        this.installError = e.message || 'Failed to install agent.';
      } finally {
        this.installing = false;
      }
    }
  }
};
</script>

<style scoped>
.install-container {
  margin: 40px auto;
  padding: 30px;
  max-width: 600px;
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--input-border);
  border-radius: 4px;
}

.success-msg {
  color: green;
  font-weight: bold;
}

.error-msg {
  color: red;
  font-weight: bold;
}
</style>
