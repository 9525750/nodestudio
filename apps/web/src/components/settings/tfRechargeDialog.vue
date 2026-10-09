<template>
  <el-dialog v-model="visible" title="TF-Router Top Up" width="min(480px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose :closeOnClickModal="false">
    <div class="rechargeContent">
      <el-form v-if="!payment" labelPosition="top" :disabled="creating" @submit.prevent="createPayment">
        <el-form-item label="Top-up Plans">
          <el-skeleton v-if="loadingSkus" :rows="3" animated />
          <template v-else>
            <div v-if="skuError" class="skuError" role="alert">
              <el-text type="danger" size="small">{{ skuError }}</el-text>
              <el-button text size="small" :disabled="creating" @click="loadSkus">Retry</el-button>
            </div>
            <el-radio-group v-model="selectedSkuId" class="rechargeOptions" aria-label="Top-up plans">
              <el-radio v-for="sku in skus" :key="sku.id" :value="sku.id" border>
                <strong class="skuPrice">{{ moneyFormat.format(sku.price) }}</strong>
                <span v-if="sku.describe" class="skuDescription">{{ sku.describe }}</span>
              </el-radio>
              <el-radio :value="-1" class="customOption" border>Custom Amount</el-radio>
            </el-radio-group>
          </template>
        </el-form-item>
        <el-form-item v-if="!loadingSkus && selectedSkuId === -1" label="Amount (CNY)">
          <el-input-number v-model="amount" class="amountInput" :min="0.01" :max="50000" :precision="2" :step="1" controlsPosition="right" placeholder="Enter amount" aria-label="Amount (CNY)" />
        </el-form-item>
        <el-form-item label="Payment Method">
          <el-radio-group v-model="payType" class="paymentMethods" aria-label="Payment method">
            <el-radio-button value="wechat"><icon-brand-wechat :size="18" />WeChat Pay</el-radio-button>
            <el-radio-button value="alipay"><icon-brand-alipay :size="18" />Alipay</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <div v-else class="paymentDetails">
        <strong class="paymentAmount">{{ moneyFormat.format(paymentAmount) }}</strong>
        <template v-if="paymentLink">
          <template v-if="payType === 'wechat'">
            <el-image class="paymentQr" :src="paymentLink" fit="contain" alt="WeChat Pay QR code">
              <template #error><el-text type="danger" size="small">QR code image failed to load</el-text></template>
            </el-image>
            <el-text>Scan with WeChat to pay</el-text>
          </template>
          <template v-else>
            <el-text>Please complete Alipay payment in your browser</el-text>
            <el-button tag="a" :href="paymentLink" target="_blank" rel="noopener noreferrer" text type="primary" :icon="IconExternalLink">Open payment page</el-button>
          </template>
        </template>
        <el-alert v-else title="Order created, but the API did not return a valid payment link" type="warning" :closable="false" showIcon />
        <div class="orderInfo">
          <el-text size="small" type="info">Order Number</el-text>
          <span>{{ payment.orderNumber }}</span>
        </div>
        <el-text size="small" type="info">After payment, close this dialog to refresh your account balance.</el-text>
      </div>
      <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" showIcon />
    </div>
    <template #footer>
      <el-button @click="visible = false">{{ payment ? 'Close' : 'Cancel' }}</el-button>
      <el-button v-if="!payment" type="primary" :icon="IconCreditCard" :loading="creating" :disabled="!canPay" @click="createPayment">{{ payType === 'wechat' ? 'Get Payment QR Code' : 'Go to Alipay' }}</el-button>
      <el-button v-else type="primary" :icon="IconRefresh" @click="visible = false">Check Balance</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { locale } from "@toonflow/i18n/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { IconBrandAlipay, IconBrandWechat, IconCreditCard, IconExternalLink, IconRefresh } from "@tabler/icons-vue";
import tf, { type TfPayment, type TfPayParams, type TfRechargeSku } from "@/lib/tf";

const props = defineProps<{ apiKey: string }>();
const visible = defineModel<boolean>({ default: false });
const amount = ref<number>();
const skus = ref<TfRechargeSku[]>([]);
const selectedSkuId = ref(-1);
const loadingSkus = ref(false);
const skuError = ref("");
const payType = ref<TfPayParams["payType"]>("wechat");
const payment = ref<TfPayment>();
const paymentAmount = ref(0);
const creating = ref(false);
const errorMessage = ref("");
const moneyFormat = computed(() => new Intl.NumberFormat(locale.value, { style: "currency", currency: "CNY" }));
const selectedAmount = computed(() => selectedSkuId.value === -1 ? amount.value : skus.value.find(sku => sku.id === selectedSkuId.value)?.price);
const canPay = computed(() => !!props.apiKey.trim() && !loadingSkus.value && typeof selectedAmount.value === "number"
  && Number.isFinite(selectedAmount.value) && selectedAmount.value >= 0.01 && (selectedSkuId.value !== -1 || selectedAmount.value <= 50000));
const paymentLink = computed(() => {
  const url = payment.value?.payUrl;
  return url && URL.canParse(url) && ["http:", "https:"].includes(new URL(url).protocol) ? url : "";
});
let controller: AbortController | undefined;
let skuController: AbortController | undefined;

async function loadSkus() {
  skuController?.abort();
  if (!visible.value || !props.apiKey.trim()) return;
  const request = new AbortController();
  skuController = request;
  loadingSkus.value = true;
  skuError.value = "";
  try {
    const result = await tf.getRechargeData({ apiKey: props.apiKey, signal: request.signal });
    if (request.signal.aborted) return;
    skus.value = result;
    selectedSkuId.value = result[0]?.id ?? -1;
  } catch (error) {
    if (!request.signal.aborted) {
      skuError.value = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : "Failed to load plans, please retry";
    }
  } finally {
    if (!request.signal.aborted) loadingSkus.value = false;
  }
}

async function createPayment() {
  if (creating.value || payment.value || !canPay.value || !visible.value) return;
  controller?.abort();
  const request = new AbortController();
  controller = request;
  creating.value = true;
  errorMessage.value = "";
  const money = selectedAmount.value!;
  try {
    const result = await tf.pay({ comboId: selectedSkuId.value, ...(selectedSkuId.value === -1 ? { customMoney: money } : {}), payType: payType.value }, { apiKey: props.apiKey, signal: request.signal });
    if (request.signal.aborted) return;
    paymentAmount.value = money;
    payment.value = result;
    if (payType.value === "alipay" && paymentLink.value) window.open(paymentLink.value, "_blank", "noopener,noreferrer");
  } catch (error) {
    if (!request.signal.aborted) {
      errorMessage.value = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : "Failed to create payment order, please retry";
    }
  } finally {
    if (!request.signal.aborted) creating.value = false;
  }
}

watch([visible, () => props.apiKey], () => {
  controller?.abort();
  skuController?.abort();
  creating.value = false;
  loadingSkus.value = false;
  skus.value = [];
  selectedSkuId.value = -1;
  skuError.value = "";
  payment.value = undefined;
  errorMessage.value = "";
  amount.value = undefined;
  if (visible.value) void loadSkus();
}, { immediate: true });
onBeforeUnmount(() => {
  controller?.abort();
  skuController?.abort();
});
</script>

<style lang="scss" scoped>
.rechargeContent {
  .skuError {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-bottom: 8px;
  }

  .rechargeOptions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: 100%;

    .el-radio {
      min-width: 0;
      height: auto;
      min-height: 66px;
      margin: 0;
      padding: 12px;

      &.is-checked {
        background: var(--el-color-primary-light-9);
      }

      :deep(.el-radio__label) {
        display: grid;
        gap: 4px;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .skuPrice {
        font-size: 16px;
        font-variant-numeric: tabular-nums;
      }

      .skuDescription {
        color: var(--el-text-color-secondary);
        font-size: 12px;
        line-height: 1.5;
      }

      &.customOption {
        grid-column: 1 / -1;
        min-height: 40px;
      }
    }
  }

  .amountInput {
    width: 100%;
  }

  .paymentMethods {
    :deep(.el-radio-button__inner) {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }

  .paymentDetails {
    display: grid;
    justify-items: center;
    gap: 16px;
    text-align: center;

    .paymentAmount {
      color: var(--el-text-color-primary);
      font-size: 28px;
      font-variant-numeric: tabular-nums;
    }

    .paymentQr {
      width: 240px;
      height: 240px;
      max-width: 100%;
      padding: 8px;
      background: #ffffff;
      border-radius: var(--el-border-radius-base);
    }

    .orderInfo {
      display: grid;
      gap: 4px;
      color: var(--el-text-color-regular);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
  }
}

@media (max-width: 480px) {
  .rechargeContent .rechargeOptions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
