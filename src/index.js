// フォルマント・ドリフト（WAM2）。声のフォルマントにあたる 3 つの山が、設定した周波数を中心に、ゆっくり揺らぎながら動く。
import { WebAudioModule } from '@webaudiomodules/sdk'
import { ParamMgrFactory } from '@webaudiomodules/sdk-parammgr'
import descriptor from '../descriptor.json'
import { createGui } from './gui.js'
import { FormantDriftNode } from './node.js'
import { PARAMS } from './params.js'

export default class FormantDrift extends WebAudioModule {
  constructor(groupId, audioContext) {
    super(groupId, audioContext)
    // SDK の既定の名前（WebAudioModule_ とクラス名、WebAudioModuleVendor）をやめて、descriptor.json の内容にする
    Object.assign(this._descriptor, descriptor)
  }

  async createAudioNode(initialState) {
    const node = new FormantDriftNode(this.audioContext)
    // パラメーターマネージャーは、イベントの受け渡しや破棄などの土台として使う（つまみの値の読み書きはノード自身が行う）
    const paramMgr = await ParamMgrFactory.create(this, {
      internalParamsConfig: Object.fromEntries(PARAMS.map((param) => [param.id, { defaultValue: param.def, minValue: param.min, maxValue: param.max }])),
    })
    node.setup(paramMgr)
    if (initialState) await node.setState(initialState)
    return node
  }

  async createGui() {
    return createGui(this.audioNode, this.audioContext)
  }
}
