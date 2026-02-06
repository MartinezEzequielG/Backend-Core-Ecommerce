export type MpPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MpPayment = {
  id: number | string;
  status?: string;
  external_reference?: string | null;
  status_detail?: string | null;
};
