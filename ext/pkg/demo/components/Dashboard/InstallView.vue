<script>
export default {
  name: 'InstallView',
  props: {
    uiService: Object,
    chartReady: Boolean,
    allReposPresent: Boolean,
    isInstalling: Boolean,
    showModal: Boolean,
    hardeningAvailable: Boolean,
    form: Object,
  },
  watch: {
    showModal(val) {
      console.log('[DEBUG] Modal visibility:', val);
    }
  },
  methods: {
    onSubmit() {
      this.$emit('install-charts');
    }
  }
};
</script>

<template>
  <div>
    <div v-if="uiService" class="p-20 text-center">
      <h3 class="text-lg font-semibold text-green-600">
        ✅ AccuKnox CWPP is activated.
      </h3>

      <button
        v-if="!hardeningAvailable"
        class="btn role-secondary mt-4"
        @click="$emit('install-hardening')"
      >
        Install Hardening Policies
      </button>
    </div>
    <div v-else>
      <div class="mt-4">
        <button
          v-if="!allReposPresent"
          class="btn role-primary mr-2"
          :disabled="isInstalling"
          @click="$emit('install-repos')"
        >
          Install Repos
        </button>

        <span v-else-if="!uiService && !chartReady" class="text-sm text-gray-500 ml-2">
          ⏳ Preparing chart... Please wait
        </span>

        <button
          v-else-if="chartReady && !uiService"
          class="btn role-secondary"
          :disabled="isInstalling"
          @click="$emit('open-modal')"
        >
          Install Charts
        </button>
      </div>

      <div v-if="showModal" class="modal-overlay">
        <div class="modal-content">
          <h2 class="text-lg font-bold mb-4">AccuKnox Agent Configuration</h2>

          <label>Access Key</label>
          <input v-model="form.accessKey" class="input" placeholder="Enter Access Key" />

          <label class="mt-4">Cluster Name</label>
          <input v-model="form.clusterName" class="input" placeholder="Cluster Name" />

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
            <button class="btn role-primary" @click="onSubmit">Install</button>
            <button class="btn ml-2" @click="$emit('close-modal')">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
