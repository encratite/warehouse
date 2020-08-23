import * as common from './common.js';

const route = common.route;

export async function login(request: common.LoginRequest): Promise<common.LoginResponse> {
	const response = await performRequest<common.LoginResponse>(route.login, request);
	return response;
}

export async function logout() {
	const request = {};
	await performRequest<void>(route.logout, request);
}

export async function validateSession(): Promise<common.ValidateSessionResponse> {
	const request = {};
	const response = await performRequest<common.ValidateSessionResponse>(route.validateSession, request);
	return response;
}

export async function getSites(): Promise<common.GetSitesResponse> {
	const request = {};
	const response = await performRequest<common.GetSitesResponse>(route.getSites, request);
	return response;
}

export async function browse(request: common.BrowseRequest): Promise<common.BrowseResponse> {
	const response = await performRequest<common.BrowseResponse>(route.browse, request);
	return response;
}

export async function search(request: common.SearchRequest): Promise<common.BrowseResponse> {
	const response = await performRequest<common.BrowseResponse>(route.search, request);
	return response;
}

export async function download(request: common.DownloadRequest) {
	await performRequest<void>(route.download, request);
}

export async function getTorrents(): Promise<common.GetTorrentsResponse> {
	const request = {};
	const response = await performRequest<common.GetTorrentsResponse>(route.getTorrents, request);
	return response;
}

export async function getSubscriptions(request: common.GetSubscriptionRequest): Promise<common.GetSubscriptionResponse> {
	const response = await performRequest<common.GetSubscriptionResponse>(route.getSubscriptions, request);
	return response;
}

export async function createSubscription(request: common.CreateSubscriptionRequest): Promise<common.CreateSubscriptionResponse> {
	const response = await performRequest<common.CreateSubscriptionResponse>(route.createSubscription, request);
	return response;
}

export async function editSubscription(request: common.EditSubscriptionRequest) {
	await performRequest<void>(route.editSubscription, request);
}

export async function deleteSubscription(request: common.DeleteSubscriptionRequest) {
	await performRequest<void>(route.deleteSubscription, request);
}

export async function getBlocklist(request: common.GetBlocklistRequest): Promise<common.GetBlocklistResponse> {
	const response = await performRequest<common.GetBlocklistResponse>(route.getBlocklist, request);
	return response;
}

export async function setBlocklist(request: common.SetBlocklistRequest) {
	await performRequest<void>(route.setBlocklist, request);
}

export async function getProfile(): Promise<common.GetProfileResponse> {
	const request = {};
	const response = await performRequest<common.GetProfileResponse>(route.getProfile, request);
	return response;
}

export async function changePassword(request: common.ChangePasswordRequest): Promise<common.ChangePasswordResponse> {
	const response = await performRequest<common.ChangePasswordResponse>(route.changePassword, request);
	return response;
}

async function performRequest<ResponseType>(path: string, request: any): Promise<ResponseType> {
	const xmlHttpRequest = new XMLHttpRequest();
	xmlHttpRequest.open('POST', `/api${path}`);
	xmlHttpRequest.setRequestHeader('Content-Type', 'application/json');
	const body = JSON.stringify(request);
	xmlHttpRequest.send(body);
	const response = await new Promise<ResponseType>((resolve, reject) => {
		const printAndReject = (message: string) => {
			console.error(message);
			reject(message);
		};
		xmlHttpRequest.onload = event => {
			const response = JSON.parse(xmlHttpRequest.responseText);
			const errorMessage = response.error;
			if (errorMessage == null) {
				resolve(<ResponseType>response);
			}
			else {
				printAndReject(errorMessage);
			}
		};
		xmlHttpRequest.onerror = event => {
			printAndReject(`Failed to call API "${path}".`);
		};
	});
	return response;
}