import { importTypes } from '@rancher/auto-import';
import { IPlugin, TableColumnLocation, PanelLocation, TabLocation } from '@shell/core/types';
import accuknoxRouting from './routing/accuknox-routing';
import {
  NAMESPACE, POD, WORKLOAD_TYPES, INGRESS, SERVICE, NODE
} from '@shell/config/types';

// Init the package
export default function(plugin: IPlugin) {
  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Provide extension metadata from package.json
  // it will grab information such as `name` and `description`
  plugin.metadata = require('./package.json');

  plugin.addProduct(require('./accuknox'));

  // // Add Vue Routes
  plugin.addRoutes(accuknoxRouting);

}
