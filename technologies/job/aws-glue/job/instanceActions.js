const { Response, JobStatus, Log, Stream } = require('@saagie/sdk');
const AWS = require('aws-sdk');

/**
 * Logic to start the external job instance.
 * @param {Object} params
 * @param {Object} params.job - Contains job data including featuresValues.
 * @param {Object} params.instance - Contains instance data.
 */
exports.start = async ({ job, instance }) => {
  try {
    console.log('START INSTANCE:', instance);
    AWS.config.update({credentials: { accessKeyId : job.featuresValues.endpoint.aws_access_key_id, secretAccessKey:  job.featuresValues.endpoint.aws_secret_access_key}});
    AWS.config.update({region: job.featuresValues.endpoint.region});

    const glue = new AWS.Glue({apiVersion: '2017-03-31'});

    const data = await glue.startJobRun({ JobName: job.featuresValues.job.id }).promise(); // throw error here

    return Response.success({ glueJobId: data.JobRunId });
  } catch (error) {
    return Response.error('Fail to start job', { error });
  }
};

/**
 * Logic to stop the external job instance.
 * @param {Object} params
 * @param {Object} params.job - Contains job data including featuresValues.
 * @param {Object} params.instance - Contains instance data including the payload returned in the start function.
 */
exports.stop = async ({ job, instance }) => {
  try {
    console.log('STOP INSTANCE:', instance);
    AWS.config.update({credentials: { accessKeyId : job.featuresValues.endpoint.aws_access_key_id, secretAccessKey:  job.featuresValues.endpoint.aws_secret_access_key}});
    AWS.config.update({region: job.featuresValues.endpoint.region});

    const glue = new AWS.Glue({apiVersion: '2017-03-31'});

    const data = await glue.batchStopJobRun({ JobName: job.featuresValues.job.id, JobRunIds: [ instance.payload.glueJobId ] }).promise();

    console.log('STOPPED', data);

    return Response.success();
  } catch (error) {
    return Response.error('Fail to stop job', { error });
  }
};

/**
 * Logic to retrieve the external job instance status.
 * @param {Object} params
 * @param {Object} params.job - Contains job data including featuresValues.
 * @param {Object} params.instance - Contains instance data including the payload returned in the start function.
 */
exports.getStatus = async ({ job, instance }) => {
  try {
    console.log('GET STATUS INSTANCE:', instance);
    AWS.config.update({credentials: { accessKeyId : job.featuresValues.endpoint.aws_access_key_id, secretAccessKey:  job.featuresValues.endpoint.aws_secret_access_key}});
    AWS.config.update({region: job.featuresValues.endpoint.region});

    const glue = new AWS.Glue({apiVersion: '2017-03-31'});

    const data = await glue.getJobRun({ JobName: job.featuresValues.job.id, RunId: instance.payload.glueJobId }).promise();

	const JOB_STATES = {
		RUNNING: JobStatus.RUNNING,
		STOPPED: JobStatus.KILLED,
		SUCCEEDED: JobStatus.SUCCEEDED,
		STARTING: JobStatus.QUEUED,
		FAILED: JobStatus.FAILED,
		STOPPING: JobStatus.KILLING,
		TIMEOUT: JobStatus.FAILED,
	};
	
	return Response.success(JOB_STATES[data.JobRun.JobRunState] || JobStatus.AWAITING);
  } catch (error) {
    return Response.error(`Failed to get status for instance ${instance}`, { error });
  }
};

/**
 * Logic to retrieve the external job instance logs.
 * @param {Object} params
 * @param {Object} params.job - Contains job data including featuresValues.
 * @param {Object} params.instance - Contains instance data including the payload returned in the start function.
 */
exports.getLogs = async ({ job, instance }) => {
  try {
    console.log('GET LOG INSTANCE:', instance);
    AWS.config.update({credentials: { accessKeyId : job.featuresValues.endpoint.aws_access_key_id, secretAccessKey:  job.featuresValues.endpoint.aws_secret_access_key}});
    AWS.config.update({region: job.featuresValues.endpoint.region});

    const cwl = new AWS.CloudWatchLogs({apiVersion: '2014-03-28'});

    const params = {
      logGroupName: '/aws-glue/jobs/output',
      logStreamName: instance.payload.glueJobId
    };

    const logs = await cwl.getLogEvents(params).promise();

    return Response.success(logs.events.map((item) => Log(item.message, Stream.STDOUT, new Date(item.timestamp*1000).toISOString())));
  } catch (error) {
    console.log(error);
    return Response.error(`Failed to get log for job ${instance.payload.glueJobId}`, { error });
  }
};
